import 'server-only';

import { cache } from 'react';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';

import { auth } from '@/server/auth';
import { authDb } from '@/server/clients/auth-db';
import * as schema from '@/server/db/schema';

import { AppError, handlePromise } from '@/lib/utils';

export const getUser = cache(async () => {
  const data = await auth.api.getSession({
    headers: await headers()
  });

  return { user: data?.user };
});

export const verifySession = cache(async () => {
  const { user } = await getUser();
  if (!user) redirect('/sign-in');

  return { user };
});

export const getOnboardedStatus = cache(async () => {
  const { user } = await verifySession();

  const { err, res } = await handlePromise(
    authDb
      .select({ id: schema.profile.id, createdAt: schema.profile.createdAt })
      .from(schema.profile)
      .where(eq(schema.profile.id, user.id))
      .limit(1)
  );

  if (err || !res) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'verify-onboarded' },
      extra: { userId: user.id }
    });

    throw new AppError({ message: 'Failed to verify onboarded status', type: 'error', capture: false });
  }

  const profile = res[0];

  return { isOnboarded: !!profile && profile.id && profile.createdAt, user };
});

export const verifyOnboarded = async () => {
  const { isOnboarded, user } = await getOnboardedStatus();
  if (!isOnboarded) redirect('/onboarding');

  return { user };
};

export const getUserMenuData = async () => {
  const { user } = await verifyOnboarded();

  const { err, res } = await handlePromise(
    authDb
      .select({
        firstName: schema.profile.firstName,
        lastName: schema.profile.lastName,
        userName: schema.user.name,
        userEmail: schema.user.email,
        userImage: schema.user.image
      })
      .from(schema.user)
      .leftJoin(schema.profile, eq(schema.user.id, schema.profile.id))
      .where(eq(schema.user.id, user.id))
      .limit(1)
  );

  const data = res?.[0];

  if (err || !data) {
    Sentry.captureException(err ?? new Error('User data not found'), {
      tags: { source: 'SERVER', flow: 'get-user-menu-data' }
    });

    throw new AppError({ message: 'Failed to get user menu data', type: 'error', capture: false });
  }

  return {
    name: data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : data.userName,
    email: data.userEmail,
    image: data.userImage
  };
};
