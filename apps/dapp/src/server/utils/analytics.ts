import 'server-only';

import { cookies, headers } from 'next/headers';

import * as Sentry from '@sentry/nextjs';

import { type AnalyticsEvent, type AnalyticsProperties, compactAnalyticsProperties } from '@/lib/analytics/events';
import { POSTHOG_ENABLED } from '@/lib/analytics/posthog-enabled';

import { env } from '@/env';

import { posthog } from '../clients/posthog';

/** posthog-js ends a session after 30 minutes without activity, or 24 hours after it started. */
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

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
  if (!POSTHOG_ENABLED) return;

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
 * The PostHog session of the browser that made this request, so a server event lands in the
 * session that caused it. posthog-js sends it as a header on same-origin fetches
 * (`tracing_headers` in instrumentation-client.ts). A full page load, such as the OAuth callback
 * or a redirect to /onboarding, carries no header, so the session falls back to PostHog's own
 * cookie while that session is still live. A Server Action's or Route Handler's after() can
 * still read both; a Server Component's after() cannot, so a page reads the session before
 * scheduling the event and passes it to captureServerEvent.
 */
export async function getBrowserSessionId() {
  try {
    const fromHeader = (await headers()).get('x-posthog-session-id');
    if (fromHeader) return fromHeader;

    const cookie = (await cookies()).get(`ph_${env.NEXT_PUBLIC_POSTHOG_KEY}_posthog`)?.value;
    if (!cookie) return undefined;

    // `$sesid` = [last activity ms, session id, session start ms]
    const [lastActivity, sessionId, start] = (JSON.parse(cookie) as { $sesid?: [number, string, number] }).$sesid ?? [];
    const now = Date.now();
    const live = now - Number(lastActivity) < SESSION_IDLE_MS && now - Number(start) < SESSION_MAX_MS;
    return typeof sessionId === 'string' && live ? sessionId : undefined;
  } catch {
    return undefined;
  }
}
