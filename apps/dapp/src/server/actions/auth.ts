'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';

import { auth } from '@/server/auth';

import { handlePromise } from '@/lib/utils';

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
