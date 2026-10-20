import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { walletLink } from '@/server/wallet-link';
import { parseWalletLinkJob } from '@/server/wallet-link/wallet-link-outbox';

import { QSTASH_NON_RETRYABLE, withQstashSignature } from '@/lib/qstash';
import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

// Operator message for a Whitelist or Revoke request — the transport half
// only. The directional check and the message itself live in
// `deliverNotification` and its Telegram adapter; here the answer becomes the
// status code QStash acts on: 200 for sent or skipped, 500 for early or
// failed so it retries, 489 for a body this outbox never produced so it does not.
/** Delivery reads every live chain for the message's whitelist line; the reconcile's budget, for the same reads. */
export const maxDuration = 60;

const handler = async (req: NextRequest) => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', 'wallet-link-telegram');

  const body = await handlePromise(req.json() as Promise<unknown>);
  if (body.err || body.res === undefined) {
    throw new ApiError({ message: 'Request body not found', capture: true, ...QSTASH_NON_RETRYABLE });
  }

  const job = parseWalletLinkJob({ kinds: ['whitelist_request', 'revoke_request'], body: body.res });
  if (!job) throw new ApiError({ message: 'Invalid request payload', capture: true, ...QSTASH_NON_RETRYABLE });

  const result = await walletLink.deliverNotification({ job });
  if (result.ok) {
    // Still a 200 — there is nothing to retry — but someone should look: the
    // address stays whitelisted under a row the sweep never reads again.
    if (result.value === 'skipped_untracked') {
      Sentry.captureMessage('Wallet link: Revoke request skipped, address whitelisted under no Linked row', {
        level: 'warning',
        extra: { linkId: job.linkId }
      });
    }
    return NextResponse.json({
      success: true,
      data: result.value === 'sent' ? 'Telegram notification sent' : 'Link moved on, skipping notification'
    });
  }

  switch (result.error.code) {
    case 'not_caught_up':
      throw new ApiError({
        message: 'Wallet link has not caught up with this job yet',
        status: 500,
        capture: false
      });
    case 'send_failed':
      throw new ApiError({
        message: 'Failed to send Telegram notification',
        status: 500,
        exception: result.error.cause,
        capture: false
      });
  }
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error sending wallet link Telegram notification', handler)(req);
});
