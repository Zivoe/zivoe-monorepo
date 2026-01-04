import 'server-only';

import { cache } from 'react';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';

import { auth } from '@/server/auth';
import { authDb } from '@/server/clients/auth-db';
import { profile } from '@/server/db/schema';

import { handlePromise } from '@/lib/utils';

export const getUser = cache(async () => {
  const data = await auth.api.getSession({
    headers: await headers()
  });

  return { user: data?.user };
});

export const verifySession = cache(async () => {
  const { user } = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  return { user };
});

export const verifyOnboarded = async () => {
  const { user } = await verifySession();

  const { err, res } = await handlePromise(
    authDb.select({ onboardedAt: profile.onboardedAt }).from(profile).where(eq(profile.id, user.id))
  );

  if (err) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'get-onboarding-status' },
      extra: { userId: user.id }
    });

    return { isOnboarded: true };
  }

  const profileData = res?.[0];

  if (!profileData) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'get-onboarding-status-timestamp' },
      extra: { userId: user.id }
    });

    return { isOnboarded: true };
  }

  return {
    isOnboarded: profileData.onboardedAt !== null
  };
};
