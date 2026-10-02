import 'server-only';

import { PostHog } from 'posthog-node';

import { env } from '@/env';

const isProduction = env.NEXT_PUBLIC_ENV === 'production';

export const posthog = new PostHog(isProduction ? env.NEXT_PUBLIC_POSTHOG_KEY : 'fake-key', {
  host: 'https://us.posthog.com',
  flushAt: 1,
  flushInterval: 0,
  // Local evaluation: flag definitions are fetched once per instance and
  // re-polled in the background, so a flag check never waits on PostHog.
  // Every poll is billed and release lists change rarely: a flag edit takes
  // up to five minutes to land.
  personalApiKey: isProduction ? env.POSTHOG_FEATURE_FLAGS_KEY : undefined,
  featureFlagsPollingInterval: 5 * 60 * 1000
});
