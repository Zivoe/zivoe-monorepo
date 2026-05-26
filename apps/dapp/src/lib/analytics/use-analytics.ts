'use client';

import { useCallback } from 'react';

import { usePostHog } from 'posthog-js/react';

import { env } from '@/env';

import { type AnalyticsEvent, type AnalyticsProperties, compactAnalyticsProperties } from './events';

export function useAnalytics() {
  const posthog = usePostHog();

  const capture = useCallback(
    (event: AnalyticsEvent, properties: AnalyticsProperties = {}) => {
      if (env.NEXT_PUBLIC_ENV !== 'production') return;
      posthog.capture(event, compactAnalyticsProperties(properties));
    },
    [posthog]
  );

  return { capture };
}
