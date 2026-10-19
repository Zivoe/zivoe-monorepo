'use client';

import { useEffect } from 'react';

import posthog from 'posthog-js';

import { useSession } from '@/lib/auth-client';

/**
 * Ties PostHog's browser identity to the signed-in user. PostHog itself is initialised in
 * instrumentation-client.ts, which also captures pageviews on every route change.
 */
export function PostHogIdentify() {
  const { data: session, isPending, error } = useSession();

  // The session is null while it loads, so waiting matters: a reset then would start a new
  // session and drop the anonymous id on every page load. It is also null when the session
  // check fails (a reload cancels it mid-flight, the network drops), which says nothing about
  // being signed out, so that waits for the next check too; a 401 is the server saying the
  // session is gone (signed out elsewhere, revoked), so that one is a sign-out. Only a browser
  // still identified as someone is reset, so a visitor arriving from the landing site keeps their history.
  useEffect(() => {
    if (isPending || (error && error.status !== 401)) return;
    if (session?.user) posthog.identify(session.user.id, { email: session.user.email });
    else if (posthog.get_property('$user_state') === 'identified') posthog.reset();
  }, [session, isPending, error]);

  return null;
}
