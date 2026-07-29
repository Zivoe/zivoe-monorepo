import 'server-only';

import { render } from '@react-email/components';
import { Resend } from 'resend';

import { handleIdempotentResult } from '@/server/utils/send-email';
import { buildUnsubscribeUrl } from '@/server/utils/unsubscribe';

import { EMAILS } from '@/lib/utils';

import { env } from '@/env';

import DepositConfirmationEmail from './deposit-confirmation-email';
import { type ReceiptTokenSymbol } from './receipt-config';
import RedemptionConfirmationEmail from './redemption-confirmation-email';

// Receipt senders live with the archived transaction monitor — their only
// caller — so src/ carries no email path that live code cannot reach. They
// return to src/server/utils/send-email.ts when the monitor is revived.
const resend = new Resend(env.RESEND_API_KEY);

export async function sendDepositConfirmationEmail({
  to,
  userId,
  inputAmount,
  inputTokenSymbol,
  sharesReceived,
  walletAddress,
  txHash,
  eventTimestamp,
  eventId
}: {
  to: string;
  userId: string;
  inputAmount: string;
  inputTokenSymbol: ReceiptTokenSymbol;
  sharesReceived: string;
  walletAddress: string;
  txHash: string;
  eventTimestamp: bigint;
  eventId: string;
}) {
  const unsubscribeUrl = buildUnsubscribeUrl({ userId, email: to, bucket: 'transaction_receipts' });
  const html = await render(
    DepositConfirmationEmail({
      inputAmount,
      inputTokenSymbol,
      sharesReceived,
      walletAddress,
      txHash,
      eventTimestamp,
      unsubscribeUrl
    })
  );

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INVESTORS,
        to,
        subject: 'Deposit Confirmed',
        html
      },
      {
        idempotencyKey: `deposit-confirmation/${eventId}/${userId}`
      }
    )
  );
}

export async function sendRedemptionConfirmationEmail({
  to,
  userId,
  zMcaRedeemed,
  usdcReceived,
  fee,
  walletAddress,
  txHash,
  eventTimestamp,
  eventId
}: {
  to: string;
  userId: string;
  zMcaRedeemed: string;
  usdcReceived: string;
  fee: string;
  walletAddress: string;
  txHash: string;
  eventTimestamp: bigint;
  eventId: string;
}) {
  const unsubscribeUrl = buildUnsubscribeUrl({ userId, email: to, bucket: 'transaction_receipts' });
  const html = await render(
    RedemptionConfirmationEmail({
      zMcaRedeemed,
      usdcReceived,
      fee,
      walletAddress,
      txHash,
      eventTimestamp,
      unsubscribeUrl
    })
  );

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INVESTORS,
        to,
        subject: 'Redemption Complete',
        html
      },
      {
        idempotencyKey: `redemption-confirmation/${eventId}/${userId}`
      }
    )
  );
}
