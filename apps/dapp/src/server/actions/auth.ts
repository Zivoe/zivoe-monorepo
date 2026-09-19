'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';

import { auth } from '@/server/auth';
import { getOnboardedStatus } from '@/server/data/auth';

import { handlePromise } from '@/lib/utils';

/**
 * Sends a freshly signed-in user to the dashboard or to onboarding. Called once the OTP verifies.
 * An action redirect carries its target's payload in the action response, so the browser makes one request.
 * A client push into `/api/auth/post-signin` cost three: Next discards a redirected RSC response and fetches
 * the target again. Social sign-in still lands on that route, where a full page load just follows the redirect.
 */
export async function continueAfterSignInAction() {
  const { isOnboarded } = await getOnboardedStatus();
  redirect(isOnboarded ? '/' : '/onboarding');
}

export async function signOutAction() {
  const { err } = await handlePromise(
    auth.api.signOut({
      headers: await headers()
    })
  );

  if (err) {
    Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'sign-out' } });
    return { error: 'Error signing out' };
  }

  redirect('/sign-in');
}
