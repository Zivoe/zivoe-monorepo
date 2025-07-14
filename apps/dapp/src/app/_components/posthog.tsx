'use client';

import { Suspense, useEffect } from 'react';

import { usePathname, useSearchParams } from 'next/navigation.js';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';

import { env } from '@/env';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(env.NEXT_PUBLIC_ENV === 'production' ? env.NEXT_PUBLIC_POSTHOG_KEY : 'fake-key', {
      api_host: '/vd3asd',
      ui_host: 'https://us.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      loaded: function (ph) {
        if (env.NEXT_PUBLIC_ENV !== 'production') {
          ph.opt_out_capturing();
          ph.set_config({ disable_session_recording: true });
        }
      }
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <SuspendedPostHogPageView />
      {children}
    </PHProvider>
  );
}

function SuspendedPostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;

    const strSearchParams = searchParams.toString();
    let url = window.origin + pathname;
    if (strSearchParams) url = url + `?${strSearchParams}`;

    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
