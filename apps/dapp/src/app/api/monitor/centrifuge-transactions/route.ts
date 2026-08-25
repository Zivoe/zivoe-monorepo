import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import {
  CENTRIFUGE_TX_MONITOR_SLUG,
  type CentrifugeTxMonitorResult,
  runCentrifugeTransactionMonitor
} from '@/server/utils/centrifuge-tx-monitor';

import { CENTRIFUGE_TX_MONITOR_CRON, withQstashSignature } from '@/lib/qstash';
import { withErrorHandler } from '@/lib/utils';

import { type ApiResponse } from '../../utils';

export const maxDuration = 60;

/** Same convention as refresh-holdings: warn while there is still headroom under Vercel's 60s kill. */
const DURATION_WARNING_MS = 45_000;

const handler = async (_req: NextRequest): ApiResponse<CentrifugeTxMonitorResult> => {
  const startTime = Date.now();

  // Scope tag, so failures captured downstream (withErrorHandler) correlate
  // with the cron monitor's flow instead of arriving untagged.
  Sentry.setTag('flow', CENTRIFUGE_TX_MONITOR_SLUG);

  const sentryCheckInId = Sentry.captureCheckIn(
    {
      monitorSlug: CENTRIFUGE_TX_MONITOR_SLUG,
      status: 'in_progress'
    },
    // The schedule lets Sentry alert on MISSED runs — the failure mode a
    // wedged route or unsynced QStash schedule would otherwise hide entirely.
    {
      schedule: { type: 'crontab', value: CENTRIFUGE_TX_MONITOR_CRON },
      checkinMargin: 5,
      maxRuntime: 2
    }
  );

  try {
    const result = await runCentrifugeTransactionMonitor();

    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: CENTRIFUGE_TX_MONITOR_SLUG,
      status: 'ok'
    });

    const durationMs = Date.now() - startTime;

    Sentry.logger.info(`${CENTRIFUGE_TX_MONITOR_SLUG} completed`, { ...result, durationMs });

    if (durationMs > DURATION_WARNING_MS) {
      Sentry.captureException(
        new Error(
          `Centrifuge transaction monitor duration (${durationMs}ms) exceeded warning threshold (${DURATION_WARNING_MS}ms)`
        ),
        {
          tags: { source: 'API', flow: CENTRIFUGE_TX_MONITOR_SLUG },
          extra: { durationMs, threshold: DURATION_WARNING_MS, ...result }
        }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: CENTRIFUGE_TX_MONITOR_SLUG,
      status: 'error'
    });

    throw error;
  } finally {
    await Sentry.flush(2000);
  }
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error running Centrifuge transaction monitor', handler)(req);
});
