import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { chainalysisAlertJobSchema, deliverChainalysisAlert } from '@/server/chainalysis/alert';

import { QSTASH_NON_RETRYABLE, withQstashSignature } from '@/lib/qstash';
import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

// Sends the alert `enqueueChainalysisAlert` queued. A failed read or send
// answers 500 so QStash retries, then the DLQ and Sentry; a body the queue
// never produced answers 489 so it does not.
const handler = async (req: NextRequest) => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', 'chainalysis-telegram');

  const body = await handlePromise(req.json() as Promise<unknown>);
  if (body.err || body.res === undefined) {
    throw new ApiError({ message: 'Request body not found', capture: true, ...QSTASH_NON_RETRYABLE });
  }

  const job = chainalysisAlertJobSchema.safeParse(body.res);
  if (!job.success) throw new ApiError({ message: 'Invalid request payload', capture: true, ...QSTASH_NON_RETRYABLE });

  const { err } = await handlePromise(deliverChainalysisAlert(job.data));
  if (err) {
    throw new ApiError({ message: 'Failed to send Chainalysis alert', status: 500, exception: err, capture: false });
  }

  return NextResponse.json({ success: true, data: 'Telegram notification sent' });
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error sending Chainalysis Telegram notification', handler)(req);
});
