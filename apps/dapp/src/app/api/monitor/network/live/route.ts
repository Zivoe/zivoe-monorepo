import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

import { CONTRACTS } from '@zivoe/contracts';

import { getDb } from '@/server/clients/db';
import { getWeb3Client } from '@/server/clients/web3';
import { DEPOSIT_DAILY_DATA_TAG } from '@/server/data';

import { ApiError, getEndOfDayUTC, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { ApiResponse } from '../../../utils';
import { collectDailyData } from '../shared';

const MONITOR_SLUG = 'deposit-daily-cron';

const handler = async (_req: NextRequest): ApiResponse<string> => {
  const sentryCheckInId = Sentry.captureCheckIn({
    monitorSlug: MONITOR_SLUG,
    status: 'in_progress'
  });

  try {
    const client = getWeb3Client();
    const db = getDb();

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

    const liveData = await collectDailyData({
      client,
      contracts: CONTRACTS,
      blockTimestamp: hourStart, // Block at current hour
      recordTimestamp: getEndOfDayUTC(recordDate) // End of day for storage
    });

    const upsertResult = await handlePromise(
      db.daily.updateOne({ timestamp: liveData.timestamp }, { $set: liveData }, { upsert: true })
    );

    if (upsertResult.err)
      throw new ApiError({ message: 'Failed to upsert live daily data', status: 500, exception: upsertResult.err });

    // Cache invalidation
    revalidateTag(DEPOSIT_DAILY_DATA_TAG, { expire: 0 });

    if (env.LANDING_PAGE_URL && env.LANDING_PAGE_REVALIDATE_API_KEY) {
      const { res, err } = await handlePromise(
        fetch(`${env.LANDING_PAGE_URL}/api/revalidate/stats`, {
          method: 'POST',
          headers: {
            'X-API-Key': env.LANDING_PAGE_REVALIDATE_API_KEY
          }
        })
      );

      if (err || !res?.ok)
        throw new ApiError({ message: 'Failed to revalidate landing page', status: 500, exception: err });
    }

    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: 'ok'
    });

    return NextResponse.json({ success: true, data: 'Deposit daily data collected' });
  } catch (error) {
    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: 'error'
    });

    throw error;
  }
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error collecting daily data', handler)(req);
});
