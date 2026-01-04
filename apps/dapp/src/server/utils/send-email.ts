import 'server-only';

import { render, toPlainText } from '@react-email/components';
import { Resend } from 'resend';

import { env } from '@/env';

import OTPEmail from './emails/otp-email';
import WelcomeEmail from './emails/welcome-email';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOTPEmail({ to, otp }: { to: string; otp: string }) {
  const html = await render(OTPEmail({ otp }));
  const text = toPlainText(html);

  const { data, error } = await resend.emails.send({
    from: 'Zivoe <no-reply@zivoe.com>',
    to,
    subject: 'Sign in to Zivoe',
    html,
    text
  });

  if (error) throw error;

  return { data };
}

export async function sendWelcomeEmail({ to, name, userId }: { to: string; name?: string; userId: string }) {
  const html = await render(WelcomeEmail({ name }));
  const text = toPlainText(html);

  const { data, error } = await resend.emails.send(
    {
      from: 'Zivoe <no-reply@zivoe.com>',
      to,
      subject: 'Welcome to Zivoe',
      html,
      text
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
