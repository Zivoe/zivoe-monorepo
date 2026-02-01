import 'server-only';

import { render } from '@react-email/components';
import { Resend } from 'resend';

import { EMAILS } from '@/lib/utils';

import { env } from '@/env';

import FirstDepositReminderEmail from './emails/first-deposit-reminder-email';
import OnboardingReminderEmail from './emails/onboarding-reminder-email';
import OTPEmail from './emails/otp-email';
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

  const { data, error } = await resend.emails.send(
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
  );

  if (error) {
    if (error.name === 'invalid_idempotent_request' || error.name === 'concurrent_idempotent_requests') {
      return { data: null };
    }

    throw error;
  }

  return { data };
}

export async function sendWelcomeEmail({ to, name, userId }: { to: string; name?: string; userId: string }) {
  const html = await render(WelcomeEmail({ name }));

  const { data, error } = await resend.emails.send(
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
  );

  if (error) {
    // Treat idempotency errors as success (email already sent or in progress)
    if (error.name === 'invalid_idempotent_request' || error.name === 'concurrent_idempotent_requests') {
      return { data: null };
    }

    throw error;
  }

  return { data };
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

  const { data, error } = await resend.emails.send(
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
  );

  if (error) {
    if (error.name === 'invalid_idempotent_request' || error.name === 'concurrent_idempotent_requests') {
      return { data: null };
    }

    throw error;
  }

  return { data };
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

  const { data, error } = await resend.emails.send(
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
  );

  if (error) {
    if (error.name === 'invalid_idempotent_request' || error.name === 'concurrent_idempotent_requests') {
      return { data: null };
    }

    throw error;
  }

  return { data };
}
