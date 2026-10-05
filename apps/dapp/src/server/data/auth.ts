import 'server-only';

import { cache } from 'react';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';
import { desc, eq, sql } from 'drizzle-orm';

import * as schema from '@zivoe/database/schema';

import { auth } from '@/server/auth';
import { db } from '@/server/clients/db';

import { ApiError, AppError, handlePromise } from '@/lib/utils';

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

/** Whether the user finished onboarding, i.e. has a profile row. Never redirects, so route handlers can call it. */
export const isUserOnboarded = async (userId: string) => {
  const { err, res } = await handlePromise(
    db
      .select({ id: schema.profile.id, createdAt: schema.profile.createdAt })
      .from(schema.profile)
      .where(eq(schema.profile.id, userId))
      .limit(1)
  );

  if (err || !res) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'verify-onboarded' },
      extra: { userId }
    });

    throw new AppError({ message: 'Failed to verify onboarded status', type: 'error', capture: false });
  }

  const profile = res[0];

  return !!profile && !!profile.id && !!profile.createdAt;
};

type TermsStatus = 'accepted' | 'outdated' | 'never';

/**
 * Where the user stands against the terms: `accepted` when their newest acceptance is at least as recent as
 * `app_config.terms_updated_at`, `outdated` when the terms changed since, `never` without one.
 * Never redirects, so route handlers can call it.
 */
export const getTermsStatus = async (userId: string): Promise<TermsStatus> => {
  const { err, res } = await handlePromise(
    db
      .select({
        // Without a config row there is no version to be behind, so any acceptance counts.
        isCurrent: sql<boolean>`${schema.termsAcceptance.acceptedAt} >= coalesce((select ${schema.appConfig.termsUpdatedAt} from ${schema.appConfig}), '-infinity')`
      })
      .from(schema.termsAcceptance)
      .where(eq(schema.termsAcceptance.userId, userId))
      .orderBy(desc(schema.termsAcceptance.acceptedAt))
      .limit(1)
  );

  if (err || !res) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'verify-terms' },
      extra: { userId }
    });

    throw new AppError({ message: 'Failed to verify terms status', type: 'error', capture: false });
  }

  const latest = res[0];
  if (!latest) return 'never';

  return latest.isCurrent ? 'accepted' : 'outdated';
};

/**
 * The page a signed-in user has to finish before the dapp opens to them: onboarding first, then the terms.
 * Null once both are done. Never redirects, so route handlers can call it.
 */
export const getRequiredStep = async (userId: string) => {
  const [termsStatus, isOnboarded] = await Promise.all([getTermsStatus(userId), isUserOnboarded(userId)]);

  if (!isOnboarded) return '/onboarding';
  if (termsStatus !== 'accepted') return '/terms';

  return null;
};

export const getAccessStatus = cache(async () => {
  const { user } = await verifySession();

  return { requiredStep: await getRequiredStep(user.id), user };
});

/** The gate for dapp pages: sends the user to onboarding or to the terms while either is unfinished. */
export const verifyOnboarded = async () => {
  const { requiredStep, user } = await getAccessStatus();
  if (requiredStep) redirect(requiredStep);

  return { user };
};

export const getUserEmailProfile = async (userId: string) => {
  const { err, res } = await handlePromise(
    db
      .select({
        email: schema.user.email,
        firstName: schema.profile.firstName,
        lastName: schema.profile.lastName,
        accountType: schema.profile.accountType,
        createdAt: schema.profile.createdAt
      })
      .from(schema.user)
      .leftJoin(schema.profile, eq(schema.user.id, schema.profile.id))
      .where(eq(schema.user.id, userId))
      .limit(1)
  );

  if (err) {
    throw new ApiError({ message: 'Failed to query user profile', exception: err, capture: false });
  }

  return res?.[0] ?? null;
};

export const getUserMenuData = async () => {
  const { user } = await verifyOnboarded();

  const { err, res } = await handlePromise(
    db
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
