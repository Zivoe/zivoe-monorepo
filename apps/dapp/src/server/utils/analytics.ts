import 'server-only';

import { headers } from 'next/headers';

import * as Sentry from '@sentry/nextjs';

import { type AnalyticsEvent, type AnalyticsProperties, compactAnalyticsProperties } from '@/lib/analytics/events';

import { env } from '@/env';

import { posthog } from '../clients/posthog';

export async function captureServerEvent({
  distinctId,
  event,
  properties = {},
  timestamp
}: {
  distinctId: string;
  event: AnalyticsEvent;
  properties?: AnalyticsProperties;
  timestamp?: Date;
}) {
  if (env.NEXT_PUBLIC_ENV !== 'production') return;

  try {
    await posthog.captureImmediate({
      distinctId,
      event,
      properties: compactAnalyticsProperties({ ...properties, $session_id: await getBrowserSessionId() }),
      timestamp
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'SERVER', flow: 'posthog-capture' },
      extra: { distinctId, event }
    });
  }
}

/**
 * The PostHog session of the browser that made this request, which posthog-js sends on
 * same-origin requests (`addTracingHeaders` in instrumentation-client.ts). With it a server
 * event lands in the session that caused it. Full page loads carry none, and headers() throws
 * inside a Server Component's after(): those events go without a session.
 */
async function getBrowserSessionId() {
  try {
    return (await headers()).get('x-posthog-session-id') ?? undefined;
  } catch {
    return undefined;
  }
}
