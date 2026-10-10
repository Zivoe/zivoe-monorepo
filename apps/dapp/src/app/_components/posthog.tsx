'use client';

import { useEffect } from 'react';

import posthog from 'posthog-js';

import { useSession } from '@/lib/auth-client';

/**
 * Ties PostHog's browser identity to the signed-in user. PostHog itself is initialised in
 * instrumentation-client.ts, which also captures pageviews on every route change.
 */
export function PostHogIdentify() {
  const { data: session, isPending } = useSession();

  // The session is null while it loads, so waiting matters: a reset then would start a new
  // session and drop the anonymous id on every page load. Only a browser still identified
  // as someone is reset, so a visitor arriving from the landing site keeps their history.
  useEffect(() => {
    if (isPending) return;
    if (session?.user) posthog.identify(session.user.id, { email: session.user.email });
    else if (posthog.get_property('$user_state') === 'identified') posthog.reset();
  }, [session, isPending]);

  return null;
}
