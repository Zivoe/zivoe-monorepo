'use client';

import { useCallback } from 'react';

import posthog from 'posthog-js';

import { type AnalyticsEvent, type AnalyticsProperties, compactAnalyticsProperties } from './events';
import { POSTHOG_ENABLED } from './posthog-enabled';

export function useAnalytics() {
  const capture = useCallback((event: AnalyticsEvent, properties: AnalyticsProperties = {}) => {
    if (!POSTHOG_ENABLED) return;
    posthog.capture(event, compactAnalyticsProperties(properties));
  }, []);

  return { capture };
}
