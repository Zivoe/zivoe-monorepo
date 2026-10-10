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
  // Flags are evaluated on the server (server/kyc/kyc-flag.ts); the browser reads none, and every
  // /flags call is billed. Keeps the remote config call that carries project settings.
  // It also hides any PostHog survey, since surveys target through flags.
  advanced_disable_feature_flags: true,
  // Sentry owns errors. Set here, this overrides the project's exception autocapture setting.
  capture_exceptions: false,
  before_send: scrubSecretParams,
  // Sends the session id on same-origin requests, so server events join the browser's session.
  addTracingHeaders: [window.location.hostname],
  loaded(ph) {
    if (env.NEXT_PUBLIC_ENV !== 'production') {
      ph.opt_out_capturing();
      ph.stopSessionRecording();
    }
  }
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
