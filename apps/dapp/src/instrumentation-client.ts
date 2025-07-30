import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_ENV === 'production',

  sampleRate: 1,
  tracesSampleRate: 0.5,
  replaysOnErrorSampleRate: 1,

  integrations: [Sentry.replayIntegration({ blockAllMedia: true, maskAllText: true })],
  debug: false
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
