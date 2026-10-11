import 'server-only';

import { waitUntil } from '@vercel/functions';
import { PostHog } from 'posthog-node';

import { env } from '@/env';

const isProduction = env.NEXT_PUBLIC_ENV === 'production';

export const posthog = new PostHog(isProduction ? env.NEXT_PUBLIC_POSTHOG_KEY : 'fake-key', {
  // The ingestion host; us.posthog.com is the app and its private API.
  host: 'https://us.i.posthog.com',
  flushAt: 1,
  flushInterval: 0,
  // Keeps the function alive until queued events are sent. The flag's `$feature_flag_called`
  // goes out through that queue during a render, and a frozen instance would drop it.
  waitUntil,
  // Local evaluation: flag definitions are fetched once per instance and
  // re-polled in the background, so a flag check never waits on PostHog.
  // Every poll is billed and release lists change rarely: a flag edit takes
  // up to five minutes to land.
  secretKey: isProduction ? env.POSTHOG_FEATURE_FLAGS_KEY : undefined,
  featureFlagsPollingInterval: 5 * 60 * 1000
});
