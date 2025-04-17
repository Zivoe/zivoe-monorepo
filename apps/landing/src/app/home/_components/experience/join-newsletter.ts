'use server';

import { z } from 'zod';

import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

const bodySchema = z.object({
  email: z.string().email()
});

export async function joinNewsletter(data: { email: string }) {
  const parsedBody = bodySchema.safeParse(data);
  if (!parsedBody.success) return { error: 'Email is not valid' };

  const { email } = parsedBody.data;

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
