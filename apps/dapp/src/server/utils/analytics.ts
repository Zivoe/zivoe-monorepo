import 'server-only';

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
      properties: compactAnalyticsProperties(properties),
      timestamp
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'SERVER', flow: 'posthog-capture' },
      extra: { distinctId, event }
    });
  }
}
