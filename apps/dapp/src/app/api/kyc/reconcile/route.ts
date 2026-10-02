import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { redis } from '@/server/clients/redis';
import { kycVerification } from '@/server/kyc';
import { type ReconcileReport } from '@/server/kyc/kyc-verification';
import { sendTelegramMessage } from '@/server/utils/send-telegram';

import { KYC_RECONCILE_CRON, KYC_RECONCILE_SLUG, KYC_RECONCILE_STEP_MINUTES, withQstashSignature } from '@/lib/qstash';
import { handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

export const maxDuration = 60;

/**
 * UTC hour at which the review backlog is reported to operators, once. The
 * count is a standing condition, not an event: capturing it every sweep would
 * re-fire every run for as long as one person waits, and the issue would
 * never age. A digest instead of an alarm, on the sweep that opens this hour
 * — the schedule step guarantees exactly one run falls inside its first step.
 */
const REVIEW_DIGEST_HOUR_UTC = 9;

/** The undecided count the last sweep saw, so a standing count is captured when it rises, not every run. */
const UNDECIDED_LAST_SEEN_KEY = 'kyc-reconcile:undecided-last-seen';

const handler = async (_req: NextRequest): ApiResponse<ReconcileReport> => {
  const startTime = Date.now();

  Sentry.setTag('flow', KYC_RECONCILE_SLUG);

  const sentryCheckInId = Sentry.captureCheckIn(
    { monitorSlug: KYC_RECONCILE_SLUG, status: 'in_progress' },
    // The schedule lets Sentry alert on MISSED runs — a route that stops
    // firing is exactly the failure this sweep exists to catch elsewhere.
    { schedule: { type: 'crontab', value: KYC_RECONCILE_CRON }, checkinMargin: 5, maxRuntime: 2 }
  );

  const now = new Date();

  try {
    const report = await kycVerification.reconcile({ now });

    // A long review is a person who has not got to it. That is work, not a
    // fault, so it goes to the operators who can act on it — and a failed
    // send must not fail the sweep, or every Persona re-read runs again.
    // Sent before the check-in reports ok: it is the slowest thing left, and
    // a run the platform kills here must show as a failed run, not a green one.
    const opensDigestHour =
      now.getUTCHours() === REVIEW_DIGEST_HOUR_UTC && now.getUTCMinutes() < KYC_RECONCILE_STEP_MINUTES;
    if (report.awaitingReview > 0 && opensDigestHour) {
      const { err } = await handlePromise(
        sendTelegramMessage({
          chatId: env.TELEGRAM_PERSONA_CHAT_ID,
          text: [
            '<b>KYC review backlog</b>',
            '',
            `<b>Awaiting manual review:</b> ${report.awaitingReview}`,
            'These are waiting on a reviewer, not on Persona.'
          ].join('\n')
        })
      );

      if (err) {
        Sentry.captureException(err, {
          tags: { source: 'API', flow: KYC_RECONCILE_SLUG },
          extra: report
        });
      }
    }

    Sentry.captureCheckIn({ checkInId: sentryCheckInId, monitorSlug: KYC_RECONCILE_SLUG, status: 'ok' });

    Sentry.logger.info(`${KYC_RECONCILE_SLUG} completed`, { ...report, durationMs: Date.now() - startTime });

    // Stable messages so every sweep groups into one issue per condition; the counts travel in extra.
    // An undecided submission or failure is a Workflow that did not run —
    // Persona decides in seconds when one exists — so it belongs in Sentry,
    // on the engineers. It is also a standing condition: captured when the
    // count rises, and once on the digest hour so a count that never moves
    // is still seen daily.
    const { res: lastSeen } = await handlePromise(redis.get<number>(UNDECIDED_LAST_SEEN_KEY));
    if (report.undecided > 0 && (report.undecided > (lastSeen ?? 0) || opensDigestHour)) {
      Sentry.captureException(
        new Error('KYC submissions or failures past the decision threshold with no Persona decision'),
        {
          tags: { source: 'API', flow: KYC_RECONCILE_SLUG },
          extra: report
        }
      );
    }
    await handlePromise(redis.set(UNDECIDED_LAST_SEEN_KEY, report.undecided));
    // The safety net must be able to report its own failure: a Persona
    // outage is otherwise a green check-in with nothing changed. The reason
    // tag tells a refused key (nothing heals it) from an outage (waits it
    // out) from an answer the mapping cannot read (`invalid_response`).
    if (report.unavailable > 0) {
      Sentry.captureException(new Error('KYC reconciliation could not read some records from Persona'), {
        tags: { source: 'API', flow: KYC_RECONCILE_SLUG, reason: report.unavailableCause?.reason },
        extra: report
      });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    Sentry.captureCheckIn({ checkInId: sentryCheckInId, monitorSlug: KYC_RECONCILE_SLUG, status: 'error' });
    throw error;
  } finally {
    await Sentry.flush(2000);
  }
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error running KYC reconciliation', handler)(req);
});
