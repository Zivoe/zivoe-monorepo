import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

import { scrubSecretParams } from '@/lib/analytics/scrub';

import { env } from '@/env';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_ENV === 'production',

  sampleRate: 1,
  tracesSampleRate: 0.5,
  replaysOnErrorSampleRate: 1,

  integrations: [Sentry.replayIntegration({ blockAllMedia: true, maskAllText: true })],
  debug: false
});

// Runs before hydration, so the first pageview is never lost. The `defaults` snapshot
// captures a pageview on every route change and a pageleave on exit.
// Identity is tied to the session by PostHogIdentify (app/_components/posthog.tsx).
posthog.init(env.NEXT_PUBLIC_ENV === 'production' ? env.NEXT_PUBLIC_POSTHOG_KEY : 'fake-key', {
  api_host: '/vd3asd',
  ui_host: 'https://us.posthog.com',
  defaults: '2026-01-30',
  before_send: scrubSecretParams,
  loaded(ph) {
    if (env.NEXT_PUBLIC_ENV !== 'production') {
      ph.opt_out_capturing();
      ph.stopSessionRecording();
    }
  }
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
