import 'server-only';

import { waitUntil } from '@vercel/functions';
import { PostHog } from 'posthog-node';

import { POSTHOG_ENABLED } from '@/lib/analytics/posthog-enabled';

import { env } from '@/env';

export const posthog = new PostHog(POSTHOG_ENABLED ? env.NEXT_PUBLIC_POSTHOG_KEY : 'fake-key', {
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
  // up to five minutes to land. Production only: previews read no flag.
  secretKey: env.NEXT_PUBLIC_ENV === 'production' ? env.POSTHOG_FEATURE_FLAGS_KEY : undefined,
  featureFlagsPollingInterval: 5 * 60 * 1000
});
