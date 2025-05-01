'use server';

import { z } from 'zod';

import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_ERROR_MESSAGE = 'Error verifying user, please refresh the page.';

const bodySchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string()
});

export async function joinNewsletter(data: { email: string; turnstileToken: string }) {
  // Validate the body
  const parsedBody = bodySchema.safeParse(data);
  if (!parsedBody.success) return { error: 'Email is not valid' };

  const { email, turnstileToken } = parsedBody.data;

  // Verify the turnstile token
  const formData = new FormData();
  formData.append('secret', env.TURNSTILE_SECRET_KEY);
  formData.append('response', turnstileToken);

  const { res: turnstile, err: turnstileError } = await handlePromise(
    fetch(TURNSTILE_URL, { method: 'POST', body: formData })
  );

  if (turnstileError || !turnstile) return { error: TURNSTILE_ERROR_MESSAGE };

  const { res: turnstileData, err: turnstileDataError } = await handlePromise(turnstile.json());
  if (turnstileDataError || !turnstileData.success) return { error: TURNSTILE_ERROR_MESSAGE };

  // Join the newsletter
  const beehiivResponse = await handlePromise(
    fetch(`https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({
        email,
        utm_source: 'landing-page-v2',
        send_welcome_email: true
      }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.BEEHIIV_API_KEY}`
      }
    })
  );

  if (beehiivResponse.err || !beehiivResponse.res?.ok) return { error: 'Error joining newsletter' };
  return { message: 'Successfully joined newsletter' };
}
