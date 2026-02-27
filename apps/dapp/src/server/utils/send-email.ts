import 'server-only';

import { render } from '@react-email/components';
import { Resend } from 'resend';

import { EMAILS } from '@/lib/utils';

import { env } from '@/env';

import type { ReceiptTokenSymbol } from './emails/receipt-config';
import DepositConfirmationEmail from './emails/deposit-confirmation-email';
import FirstDepositReminderEmail from './emails/first-deposit-reminder-email';
import OnboardingReminderEmail from './emails/onboarding-reminder-email';
import OTPEmail from './emails/otp-email';
import RedemptionConfirmationEmail from './emails/redemption-confirmation-email';
import SecondDepositReminderEmail from './emails/second-deposit-reminder-email';
import WelcomeEmail from './emails/welcome-email';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOTPEmail({ to, otp }: { to: string; otp: string }) {
  const html = await render(OTPEmail({ otp }));

  const { data, error } = await resend.emails.send({
    from: 'Zivoe <verify@auth.zivoe.com>',
    replyTo: EMAILS.INVESTORS,
    to,
    subject: 'Sign in to Zivoe',
    html
  });

  if (error) throw error;

  return { data };
}

export async function sendOnboardingReminderEmail({ to, name, userId }: { to: string; name?: string; userId: string }) {
  const html = await render(OnboardingReminderEmail({ name }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INVESTORS,
        to,
        subject: 'Almost There',
        html
      },
      {
        idempotencyKey: `onboarding-reminder-email/${userId}`
      }
    )
  );
}

export async function sendWelcomeEmail({ to, name, userId }: { to: string; name?: string; userId: string }) {
  const html = await render(WelcomeEmail({ name }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INVESTORS,
        to,
        subject: 'Welcome to Zivoe',
        html
      },
      {
        idempotencyKey: `welcome-email/${userId}`
      }
    )
  );
}

export async function sendFirstDepositReminderEmail({
  to,
  name,
  accountType,
  userId
}: {
  to: string;
  name?: string;
  accountType: 'individual' | 'organization';
  userId: string;
}) {
  const html = await render(FirstDepositReminderEmail({ name, accountType }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INVESTORS,
        to,
        subject: 'Getting Started',
        html
      },
      {
        idempotencyKey: `first-deposit-reminder-email/${userId}`
      }
    )
  );
}

export async function sendSecondDepositReminderEmail({
  to,
  name,
  accountType,
  userId
}: {
  to: string;
  name?: string;
  accountType: 'individual' | 'organization';
  userId: string;
}) {
  const html = await render(SecondDepositReminderEmail({ name, accountType }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INVESTORS,
        to,
        subject: 'Last Nudge',
        html
      },
      {
        idempotencyKey: `second-deposit-reminder-email/${userId}`
      }
    )
  );
}

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
  const html = await render(
    DepositConfirmationEmail({
      inputAmount,
      inputTokenSymbol,
      sharesReceived,
      walletAddress,
      txHash,
      eventTimestamp
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
  zVLTRedeemed,
  usdcReceived,
  fee,
  walletAddress,
  txHash,
  eventTimestamp,
  eventId
}: {
  to: string;
  userId: string;
  zVLTRedeemed: string;
  usdcReceived: string;
  fee: string;
  walletAddress: string;
  txHash: string;
  eventTimestamp: bigint;
  eventId: string;
}) {
  const html = await render(
    RedemptionConfirmationEmail({ zVLTRedeemed, usdcReceived, fee, walletAddress, txHash, eventTimestamp })
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

function handleIdempotentResult<T>({
  data,
  error
}: {
  data: T | null;
  error: { name: string; message: string } | null;
}): { data: T | null } {
  if (error) {
    if (error.name === 'invalid_idempotent_request' || error.name === 'concurrent_idempotent_requests') {
      return { data: null };
    }
    throw error;
  }
  return { data };
}
