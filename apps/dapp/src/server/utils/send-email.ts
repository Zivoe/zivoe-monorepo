import 'server-only';

import { render } from '@react-email/components';
import { Resend } from 'resend';

import { EMAILS } from '@/lib/utils';

import { env } from '@/env';

import { buildTransactionReceiptEmail } from './centrifuge-tx-receipt-email';
import { type TransactionReceiptJob, buildReceiptJobKey } from './centrifuge-tx-receipt-job';
import FirstDepositReminderEmail from './emails/first-deposit-reminder-email';
import OnboardingReminderEmail from './emails/onboarding-reminder-email';
import OTPEmail from './emails/otp-email';
import SecondDepositReminderEmail from './emails/second-deposit-reminder-email';
import WelcomeEmail from './emails/welcome-email';
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl } from './unsubscribe';

const resend = new Resend(env.RESEND_API_KEY);
const PRODUCT_TIPS_LIST_ID = 'Product Tips <product-tips.zivoe.com>';

export async function sendOTPEmail({ to, otp }: { to: string; otp: string }) {
  const html = await render(OTPEmail({ otp }));

  const { data, error } = await resend.emails.send({
    from: 'Zivoe <verify@auth.zivoe.com>',
    replyTo: EMAILS.INQUIRE,
    to,
    subject: 'Sign in to Zivoe',
    html
  });

  if (error) throw new Error(error.message, { cause: error });

  return { data };
}

export async function sendOnboardingReminderEmail({ to, name, userId }: { to: string; name?: string; userId: string }) {
  const { footerUnsubscribeUrl, oneClickHeaders } = getProductTipsUnsubscribeMetadata({ userId, email: to });
  const html = await render(OnboardingReminderEmail({ name, unsubscribeUrl: footerUnsubscribeUrl }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Need help completing your Zivoe onboarding?',
        html,
        headers: oneClickHeaders
      },
      {
        idempotencyKey: `onboarding-reminder-email/${userId}`
      }
    )
  );
}

export async function sendWelcomeEmail({ to, name, userId }: { to: string; name?: string; userId: string }) {
  const { footerUnsubscribeUrl, oneClickHeaders } = getProductTipsUnsubscribeMetadata({ userId, email: to });
  const html = await render(WelcomeEmail({ name, unsubscribeUrl: footerUnsubscribeUrl }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Welcome to Zivoe',
        html,
        headers: oneClickHeaders
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
  const { footerUnsubscribeUrl, oneClickHeaders } = getProductTipsUnsubscribeMetadata({ userId, email: to });
  const html = await render(FirstDepositReminderEmail({ name, accountType, unsubscribeUrl: footerUnsubscribeUrl }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Ready to put your stablecoins to work?',
        html,
        headers: oneClickHeaders
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
  const { footerUnsubscribeUrl, oneClickHeaders } = getProductTipsUnsubscribeMetadata({ userId, email: to });
  const html = await render(SecondDepositReminderEmail({ name, accountType, unsubscribeUrl: footerUnsubscribeUrl }));

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Thor from Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject: 'Still interested in Zivoe?',
        html,
        headers: oneClickHeaders
      },
      {
        idempotencyKey: `second-deposit-reminder-email/${userId}`
      }
    )
  );
}

/**
 * One transaction receipt to one linked user. Plain transactional mail from
 * the neutral sender — no persona, no List-Unsubscribe headers (those are the
 * bulk buckets' concern); the footer unsubscribe drives the
 * transaction_receipts preference. Resend's idempotency key (kept 24 hours)
 * absorbs the crash-between-send-and-record replay the DB dedupe cannot see.
 */
export async function sendTransactionReceiptEmail({
  to,
  userId,
  job,
  symbol,
  shareDecimals,
  viewInAppUrl
}: {
  to: string;
  userId: string;
  job: TransactionReceiptJob;
  symbol: string;
  shareDecimals: number;
  viewInAppUrl: string;
}) {
  const unsubscribeUrl = buildUnsubscribeUrl({ userId, email: to, bucket: 'transaction_receipts' });
  const { subject, email } = buildTransactionReceiptEmail({ job, symbol, shareDecimals, viewInAppUrl, unsubscribeUrl });
  const html = await render(email);

  return handleIdempotentResult(
    await resend.emails.send(
      {
        from: 'Zivoe <hello@auth.zivoe.com>',
        replyTo: EMAILS.INQUIRE,
        to,
        subject,
        html
      },
      {
        idempotencyKey: `transaction-receipt/${buildReceiptJobKey({ eventId: job.eventId, userId })}`
      }
    )
  );
}

export function handleIdempotentResult<T>({
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
    throw new Error(error.message, { cause: error });
  }
  return { data };
}

function getProductTipsUnsubscribeMetadata({ userId, email }: { userId: string; email: string }) {
  const footerUnsubscribeUrl = buildUnsubscribeUrl({ userId, email, bucket: 'product_tips' });
  const oneClickUnsubscribeUrl = buildOneClickUnsubscribeUrl({ userId, email });

  return {
    footerUnsubscribeUrl,
    oneClickHeaders: {
      'List-Id': PRODUCT_TIPS_LIST_ID,
      'List-Unsubscribe': `<${oneClickUnsubscribeUrl}>, <mailto:${EMAILS.INQUIRE}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}
