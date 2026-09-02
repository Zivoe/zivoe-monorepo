import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { transactionReceiptJobSchema } from '@/server/utils/centrifuge-tx-receipt-job';
import { runReceiptMailer } from '@/server/utils/centrifuge-tx-receipt-mailer';

import { withQstashSignature } from '@/lib/qstash';
import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

// Payloads come from the Transaction Monitor, so an invalid one is a
// contract bug, not user input — and nothing a retry can fix. 489 with this
// header is QStash's terminal answer: no retries, straight to the DLQ, where
// the failure callback surfaces it. A plain 400 would cost three retries
// over half an hour first. Captured as well: a payload the monitor produced
// and this route cannot read is a contract bug worth its own Sentry issue,
// not something to notice only if the DLQ callback fires.
const NON_RETRYABLE = { status: 489, headers: { 'Upstash-NonRetryable-Error': 'true' } } as const;

const handler = async (req: NextRequest) => {
  // Scope tag, so mailer failures captured downstream (withErrorHandler)
  // correlate as this flow instead of arriving untagged.
  Sentry.setTag('flow', 'transaction-receipt-email');

  const body = await handlePromise(req.json() as Promise<unknown>);
  if (body.err || body.res === undefined)
    throw new ApiError({ message: 'Request body not found', capture: true, ...NON_RETRYABLE });

  const parsed = transactionReceiptJobSchema.safeParse(body.res);
  if (!parsed.success) throw new ApiError({ message: 'Invalid request payload', capture: true, ...NON_RETRYABLE });

  const result = await runReceiptMailer(parsed.data);

  return NextResponse.json({ success: true, data: result });
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error sending transaction receipt email', handler)(req);
});
