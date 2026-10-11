import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

import { POSTHOG_ENABLED } from '@/lib/analytics/posthog-enabled';
import { scrubSecretParams, scrubSecretUrl } from '@/lib/analytics/scrub';

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
// captures a pageview on every route change and a pageleave on exit, drops URL fragments,
// and lets the identity cookie shared across zivoe.com win over this origin's localStorage.
// Keep it the same in the dapp and the landing: they share that cookie.
// Identity is tied to the session by PostHogIdentify (app/_components/posthog.tsx).
posthog.init(POSTHOG_ENABLED ? env.NEXT_PUBLIC_POSTHOG_KEY : 'fake-key', {
  api_host: '/vd3asd',
  ui_host: 'https://us.posthog.com',
  defaults: '2026-08-30',
  // Flags are evaluated on the server (server/kyc/kyc-flag.ts); the browser reads none, and every
  // /flags call is billed. Keeps the remote config call that carries project settings.
  // It also hides any PostHog survey, since surveys target through flags.
  advanced_disable_feature_flags: true,
  // Sentry owns errors. Set here, this overrides the project's exception autocapture setting.
  capture_exceptions: false,
  before_send: scrubSecretParams,
  // Replay keeps the page URL and every request URL inside its snapshots, where before_send
  // does not look; the recorder passes each of them through this before storing it.
  session_recording: {
    maskCapturedNetworkRequestFn: (request) => ({ ...request, name: scrubSecretUrl(request.name) })
  },
  ...(POSTHOG_ENABLED
    ? // Sends the session id on same-origin requests, so server events join the browser's session.
      { tracing_headers: [window.location.hostname] }
    : // A local run sends, records, fetches and loads nothing.
      {
        opt_out_capturing_by_default: true,
        disable_session_recording: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true
      })
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
