import 'server-only';

import { PostHog } from 'posthog-node';

import { env } from '@/env';

export const posthog = new PostHog(env.NEXT_PUBLIC_ENV === 'production' ? env.NEXT_PUBLIC_POSTHOG_KEY : 'fake-key', {
  host: 'https://us.posthog.com',
  flushAt: 1,
  flushInterval: 0
});
