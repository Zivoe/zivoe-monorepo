import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';

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

// PostHog runs on every Vercel deployment and never locally: production reports to the
// "Zivoe" project and previews to "Zivoe - staging", each through the NEXT_PUBLIC_POSTHOG_KEY
// its Vercel environment carries.
const POSTHOG_ENABLED = env.NEXT_PUBLIC_VERCEL_ENV !== 'development';

// Runs before hydration, so the first pageview is never lost. The `defaults` snapshot drops
// URL fragments and lets the identity cookie shared across zivoe.com win over this origin's
// localStorage; a pageleave goes out on exit.
// Keep it the same in the dapp and the landing: they share that cookie.
posthog.init(POSTHOG_ENABLED ? env.NEXT_PUBLIC_POSTHOG_KEY : 'fake-key', {
  api_host: '/asbr3d',
  ui_host: 'https://us.posthog.com',
  defaults: '2026-08-30',
  // A pageview on every path or query-string change (category chips, pages and search); the `defaults` alone
  // count path changes only.
  capture_pageview: { path: true, search: true },
  // The landing reads no flags, and every /flags call is billed. Keeps the remote config call
  // that carries project settings.
  advanced_disable_feature_flags: true,
  // No surveys run here; without this the SDK still downloads the surveys script on every load.
  disable_surveys: true,
  // Sentry owns errors. Set here, this overrides the project's exception autocapture setting.
  capture_exceptions: false,
  // A local run sends, records, fetches and loads nothing.
  ...(POSTHOG_ENABLED
    ? {}
    : {
        opt_out_capturing_by_default: true,
        disable_session_recording: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true
      })
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
