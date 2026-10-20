import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { sendBatchedTelegramMessages } from '@/server/utils/send-telegram';
import { walletLink } from '@/server/wallet-link';
import { type WalletLinkReconcileReport } from '@/server/wallet-link/wallet-link';

import { WALLET_LINK_RECONCILE_CRON, WALLET_LINK_RECONCILE_SLUG, withQstashSignature } from '@/lib/qstash';
import { handlePromise, truncateAddress, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

export const maxDuration = 60;

/**
 * UTC hour of the one run per day that tells ops about stalled rows. A stalled
 * whitelist is a standing condition, not an event: reporting it on
 * every hourly run would repeat it twenty-four times. The sweep itself stays
 * hourly so the "you're whitelisted" email goes out within the hour.
 */
const DIGEST_HOUR_UTC = 9;

type StalledRow = WalletLinkReconcileReport['stuck'][number];

/** One line per stalled row — the operator needs the address, how far it got, how long it has waited, and the link to find it by. */
const line = (row: StalledRow) =>
  `${truncateAddress(row.address)} · ${row.memberOn} of ${row.total} chains · day ${row.daysWaiting}${row.isLastReminder ? ' (last reminder)' : ''} · link ${row.linkId}`;

const handler = async (_req: NextRequest): ApiResponse<WalletLinkReconcileReport> => {
  const startTime = Date.now();

  Sentry.setTag('flow', WALLET_LINK_RECONCILE_SLUG);

  const sentryCheckInId = Sentry.captureCheckIn(
    { monitorSlug: WALLET_LINK_RECONCILE_SLUG, status: 'in_progress' },
    // The schedule lets Sentry alert on MISSED runs — a sweep that stops
    // firing is a stalled whitelist nobody hears about.
    { schedule: { type: 'crontab', value: WALLET_LINK_RECONCILE_CRON }, checkinMargin: 5, maxRuntime: 2 }
  );

  const now = new Date();

  try {
    const report = await walletLink.reconcile({ now });

    // Stalled rows are the operators' work, not a fault of the app, so they go
    // to the wallet-link channel and nowhere else — once a day, on the digest
    // run. The one thing that is ours, chains the sweep could not read, is
    // reported to Sentry on the same run.
    const isDigestRun = now.getUTCHours() === DIGEST_HOUR_UTC;
    if (isDigestRun) {
      // One item per line, so a long digest splits across messages at a line
      // instead of failing Telegram's size limit.
      const items =
        report.stuck.length > 0 ? ['<b>Wallet link: still not whitelisted</b>', ...report.stuck.map(line)] : [];

      // A failed send must not fail the sweep (every membership read would run
      // again), but it is sent before the check-in reports ok: a run the
      // platform kills here must show as a failed run, not a green one.
      if (items.length > 0) {
        const { err } = await handlePromise(
          sendBatchedTelegramMessages({ chatId: env.TELEGRAM_WALLET_LINK_CHAT_ID, items, separator: '\n' })
        );
        if (err) {
          Sentry.captureException(err, { tags: { source: 'API', flow: WALLET_LINK_RECONCILE_SLUG }, extra: report });
        }
      }

      if (report.unchecked > 0) {
        Sentry.captureMessage('Wallet link reconcile could not read membership on some chain', {
          level: 'warning',
          tags: { source: 'API', flow: WALLET_LINK_RECONCILE_SLUG },
          extra: report
        });
      }
    }

    Sentry.captureCheckIn({ checkInId: sentryCheckInId, monitorSlug: WALLET_LINK_RECONCILE_SLUG, status: 'ok' });

    Sentry.logger.info(`${WALLET_LINK_RECONCILE_SLUG} completed`, {
      checked: report.checked,
      whitelisted: report.whitelisted,
      ended: report.ended,
      unchecked: report.unchecked,
      stuck: report.stuck.length,
      digest: isDigestRun,
      durationMs: Date.now() - startTime
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    Sentry.captureCheckIn({ checkInId: sentryCheckInId, monitorSlug: WALLET_LINK_RECONCILE_SLUG, status: 'error' });
    throw error;
  } finally {
    await Sentry.flush(2000);
  }
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error running wallet link reconciliation', handler)(req);
});
