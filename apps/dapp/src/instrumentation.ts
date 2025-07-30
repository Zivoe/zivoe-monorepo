import type { Instrumentation } from 'next';

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError: Instrumentation.onRequestError = (...args) => {
  Sentry.withScope((scope) => {
    scope.setTag('source', 'SERVER');
    scope.setTag('route_type', args[2]?.routeType || 'unknown');
    Sentry.captureRequestError(...args);
  });
};
