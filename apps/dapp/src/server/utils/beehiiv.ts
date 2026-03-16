import 'server-only';

import { env } from '@/env';

const BEEHIIV_BASE_URL = `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUBLICATION_ID}`;

const BEEHIIV_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Authorization: `Bearer ${env.BEEHIIV_API_KEY}`
};

type BeehiivSubscriptionResponse = {
  data?: {
    id?: string;
    email?: string;
    status?: 'validating' | 'invalid' | 'pending' | 'active' | 'inactive' | 'needs_attention';
  };
};

export async function getBeehiivNewsletterPreference(email: string) {
  const subscription = await getBeehiivSubscriptionByEmail(email);
  return subscription?.status === 'active';
}

export async function subscribeToBeehiiv({
  email,
  utmSource,
  sendWelcomeEmail,
  reactivateExisting = false
}: {
  email: string;
  utmSource: string;
  sendWelcomeEmail: boolean;
  reactivateExisting?: boolean;
}) {
  const response = await fetch(`${BEEHIIV_BASE_URL}/subscriptions`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      utm_source: utmSource,
      send_welcome_email: sendWelcomeEmail,
      reactivate_existing: reactivateExisting
    }),
    headers: BEEHIIV_HEADERS
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'Failed to read response body');
    throw new Error(`Beehiiv API error ${response.status}: ${body}`);
  }
}

export async function syncBeehiivNewsletterPreference({ email, subscribed }: { email: string; subscribed: boolean }) {
  const subscription = await getBeehiivSubscriptionByEmail(email);

  if (!subscribed) {
    if (!subscription) return;

    await updateBeehiivSubscriptionByEmail({
      email,
      unsubscribe: true
    });

    return;
  }

  if (!subscription) {
    await subscribeToBeehiiv({
      email,
      utmSource: 'dapp-v2',
      sendWelcomeEmail: false
    });
    return;
  }

  if (subscription.status === 'active') return;

  await subscribeToBeehiiv({
    email,
    utmSource: 'dapp-v2',
    sendWelcomeEmail: false,
    reactivateExisting: true
  });
}

async function getBeehiivSubscriptionByEmail(email: string) {
  const encodedEmail = encodeURIComponent(email);
  const response = await fetch(`${BEEHIIV_BASE_URL}/subscriptions/by_email/${encodedEmail}`, {
    method: 'GET',
    headers: BEEHIIV_HEADERS
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text().catch(() => 'Failed to read response body');
    throw new Error(`Beehiiv API error ${response.status}: ${body}`);
  }

  const payload = (await response.json()) as BeehiivSubscriptionResponse;
  return payload.data ?? null;
}

async function updateBeehiivSubscriptionByEmail({ email, unsubscribe }: { email: string; unsubscribe: boolean }) {
  const encodedEmail = encodeURIComponent(email);
  const response = await fetch(`${BEEHIIV_BASE_URL}/subscriptions/by_email/${encodedEmail}`, {
    method: 'PUT',
    body: JSON.stringify({ unsubscribe }),
    headers: BEEHIIV_HEADERS
  });

  if (!response.ok) {
    const body = await response.text().catch(() => 'Failed to read response body');
    throw new Error(`Beehiiv API error ${response.status}: ${body}`);
  }
}
