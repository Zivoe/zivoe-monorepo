'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

import { scrubSecretUrl } from '@/lib/analytics/scrub';

import { env } from '@/env';

/**
 * Vercel Web Analytics without the unsubscribe token in the page URLs it sends
 * (lib/analytics/scrub.ts). A client component, because `beforeSend` is a function.
 */
export function VercelAnalytics() {
  return <Analytics mode={env.NEXT_PUBLIC_ENV} beforeSend={scrubEventUrl} />;
}

const scrubEventUrl = (event: BeforeSendEvent) => ({ ...event, url: scrubSecretUrl(event.url) });
