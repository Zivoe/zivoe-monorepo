import 'server-only';

import { render, toPlainText } from '@react-email/components';
import { Resend } from 'resend';

import OTPEmail from '@/components/otp-email';

import { env } from '@/env';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOTPEmail({ to, otp }: { to: string; otp: string }) {
  const html = await render(OTPEmail({ otp }));
  const text = toPlainText(html);

  const { data, error } = await resend.emails.send({
    from: 'Acme <onboarding@resend.dev>',
    to,
    subject: 'Sign in to Zivoe',
    html,
    text
  });

  if (error) throw error;

  return { data };
}
