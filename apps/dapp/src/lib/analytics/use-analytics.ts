'use client';

import { useCallback } from 'react';

import posthog from 'posthog-js';

import { env } from '@/env';

import { type AnalyticsEvent, type AnalyticsProperties, compactAnalyticsProperties } from './events';

export function useAnalytics() {
  const capture = useCallback((event: AnalyticsEvent, properties: AnalyticsProperties = {}) => {
    if (env.NEXT_PUBLIC_ENV !== 'production') return;
    posthog.capture(event, compactAnalyticsProperties(properties));
  }, []);

  return { capture };
}
