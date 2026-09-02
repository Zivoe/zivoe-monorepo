import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { transactionReceiptJobSchema } from '@/server/utils/centrifuge-tx-receipt-job';
import { runReceiptMailer } from '@/server/utils/centrifuge-tx-receipt-mailer';

import { withQstashSignature } from '@/lib/qstash';
import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

// Payloads come from the Transaction Monitor, so an invalid one is a
// contract bug, not user input: the 400 makes QStash retry into the DLQ,
// where the failure callback surfaces it.
const handler = async (req: NextRequest) => {
  // Scope tag, so mailer failures captured downstream (withErrorHandler)
  // correlate as this flow instead of arriving untagged.
  Sentry.setTag('flow', 'transaction-receipt-email');

  const body = await handlePromise(req.json() as Promise<unknown>);
  if (body.err || body.res === undefined)
    throw new ApiError({ message: 'Request body not found', status: 400, capture: false });

  const parsed = transactionReceiptJobSchema.safeParse(body.res);
  if (!parsed.success) throw new ApiError({ message: 'Invalid request payload', status: 400, capture: false });

  const result = await runReceiptMailer(parsed.data);

  return NextResponse.json({ success: true, data: result });
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error sending transaction receipt email', handler)(req);
});
