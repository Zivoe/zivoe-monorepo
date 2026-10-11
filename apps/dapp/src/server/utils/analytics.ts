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
  sessionId,
  timestamp
}: {
  distinctId: string;
  event: AnalyticsEvent;
  properties?: AnalyticsProperties;
  /** Read with getBrowserSessionId() by a caller whose request is gone by the time this runs. */
  sessionId?: string;
  timestamp?: Date;
}) {
  if (env.NEXT_PUBLIC_ENV !== 'production') return;

  try {
    await posthog.captureImmediate({
      distinctId,
      event,
      properties: compactAnalyticsProperties({
        ...properties,
        $session_id: sessionId ?? (await getBrowserSessionId())
      }),
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
 * same-origin requests (`tracing_headers` in instrumentation-client.ts). With it a server
 * event lands in the session that caused it. Full page loads carry none. A Server Action's
 * or Route Handler's after() can still read it; a Server Component's after() cannot, so a
 * page reads it before scheduling the event and passes it to captureServerEvent.
 */
export async function getBrowserSessionId() {
  try {
    return (await headers()).get('x-posthog-session-id') ?? undefined;
  } catch {
    return undefined;
  }
}
