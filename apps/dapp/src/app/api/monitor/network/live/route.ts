import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { CONTRACTS } from '@zivoe/contracts';

import { getWeb3Client } from '@/server/clients/web3';
import { upsertProtocolDailySnapshot } from '@/server/data/protocol-daily-snapshot';

import { withQstashSignature } from '@/lib/qstash';
import { ApiError, getEndOfDayUTC, handlePromise, withErrorHandler } from '@/lib/utils';

import { type ApiResponse } from '../../../utils';
import { collectProtocolDailySnapshot, revalidateProtocolDailySnapshotCaches } from '../shared';

const MONITOR_SLUG = 'network-hourly-cron';

const handler = async (_req: NextRequest): ApiResponse<string> => {
  const sentryCheckInId = Sentry.captureCheckIn({
    monitorSlug: MONITOR_SLUG,
    status: 'in_progress'
  });

  try {
    const client = getWeb3Client();

    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setUTCMinutes(0, 0, 0); // Floor to top of hour

    // Determine which day we're recording for
    // Midnight (hour 0) = previous day's final snapshot
    // Other hours = current day's snapshot (will be overwritten by later runs)
    const recordDate =
      hourStart.getUTCHours() === 0
        ? new Date(hourStart.getTime() - 1) // Previous day
        : hourStart; // Same day

    const liveData = await collectProtocolDailySnapshot({
      client,
      contracts: CONTRACTS,
      blockTimestamp: hourStart, // Block at current hour
      recordTimestamp: getEndOfDayUTC(recordDate) // End of day for storage
    });

    const upsertResult = await handlePromise(upsertProtocolDailySnapshot(liveData));

    if (upsertResult.err)
      throw new ApiError({
        message: 'Failed to upsert live protocol daily snapshot',
        status: 500,
        exception: upsertResult.err
      });

    await revalidateProtocolDailySnapshotCaches();

    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: 'ok'
    });

    return NextResponse.json({ success: true, data: 'Protocol daily snapshot collected' });
  } catch (error) {
    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: 'error'
    });

    throw error;
  } finally {
    await Sentry.flush(2000);
  }
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error collecting protocol daily snapshot', handler)(req);
});
