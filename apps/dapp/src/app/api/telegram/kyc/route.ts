import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { kycVerification } from '@/server/kyc';
import { parseKycNotificationJob } from '@/server/kyc/kyc-outbox';

import { QSTASH_NON_RETRYABLE, withQstashSignature } from '@/lib/qstash';
import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

// Operator message for a lifecycle move in `KYC_OPERATOR_STATUSES` — the
// transport half only. The directional check and the message itself live in
// `deliverNotification` and its Telegram adapter; here the answer becomes the
// status code QStash acts on: 200 for sent or skipped, 500 for early or
// failed so it retries, 489 for a body this outbox never produced so it does not.
const handler = async (req: NextRequest) => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', 'kyc-telegram');

  const body = await handlePromise(req.json() as Promise<unknown>);
  if (body.err || body.res === undefined) {
    throw new ApiError({ message: 'Request body not found', capture: true, ...QSTASH_NON_RETRYABLE });
  }

  const notification = parseKycNotificationJob({ kind: 'operator_message', body: body.res });
  if (!notification) throw new ApiError({ message: 'Invalid request payload', capture: true, ...QSTASH_NON_RETRYABLE });

  const result = await kycVerification.deliverNotification({ notification });
  if (result.ok) {
    return NextResponse.json({
      success: true,
      data: result.value === 'sent' ? 'Telegram notification sent' : 'Status moved on, skipping notification'
    });
  }

  switch (result.error.code) {
    case 'not_caught_up':
      throw new ApiError({
        message: 'KYC Verification has not caught up with this job yet',
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
  return withErrorHandler('Error sending KYC Telegram notification', handler)(req);
});
