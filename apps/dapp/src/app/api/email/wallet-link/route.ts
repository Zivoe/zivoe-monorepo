import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { walletLink } from '@/server/wallet-link';
import { parseWalletLinkJob } from '@/server/wallet-link/wallet-link-outbox';

import { QSTASH_NON_RETRYABLE, withQstashSignature } from '@/lib/qstash';
import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

// A QStash receiver in the shape of the KYC status email route, and
// transport only: the directional check and the send live in
// `deliverNotification`. Here its answer becomes the status code QStash acts
// on — 200 for sent or skipped, 500 for early or failed so it retries, 489
// for a body this outbox never produced so it does not. No unsubscribe
// check on purpose: a whitelisted address is a fact about the person's
// account, i.e. transactional.
const handler = async (req: NextRequest) => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', 'wallet-link-email');

  const body = await handlePromise(req.json() as Promise<unknown>);
  if (body.err || body.res === undefined) {
    throw new ApiError({ message: 'Request body not found', capture: true, ...QSTASH_NON_RETRYABLE });
  }

  const job = parseWalletLinkJob({ kinds: ['whitelisted_email'], body: body.res });
  if (!job) throw new ApiError({ message: 'Invalid request payload', capture: true, ...QSTASH_NON_RETRYABLE });

  const result = await walletLink.deliverNotification({ job });
  if (result.ok) {
    return NextResponse.json({
      success: true,
      data: result.value === 'sent' ? 'Address whitelisted email sent' : 'Link moved on, skipping email'
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
        message: 'Failed to send address whitelisted email',
        status: 500,
        exception: result.error.cause,
        capture: false
      });
  }
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error sending address whitelisted email', handler)(req);
});
