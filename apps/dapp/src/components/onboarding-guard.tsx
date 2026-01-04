// import { type ReactNode, useEffect, useState } from 'react';
import { Suspense } from 'react';

import { redirect } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';

import { authDb } from '@/server/clients/auth-db';
import { verifySession } from '@/server/data/auth';
import { profile } from '@/server/db/schema';

import { handlePromise } from '@/lib/utils';

// TODO: optimization - after the AppShell refactor, move this to the (app) layout to only check onboarding status once
export default function OnboardingGuard() {
  return (
    <Suspense fallback={null}>
      <OnboardingGuardComponent />
    </Suspense>
  );
}

async function OnboardingGuardComponent() {
  const { user } = await verifySession();

  const { err, res } = await handlePromise(
    authDb.select({ onboardedAt: profile.onboardedAt }).from(profile).where(eq(profile.id, user.id))
  );

  if (err) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'get-onboarding-status' },
      extra: { userId: user.id }
    });

    return null;
  }

  const profileData = res?.[0];

  if (!profileData) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'get-onboarding-status-timestamp' },
      extra: { userId: user.id }
    });

    return null;
  }

  if (profileData.onboardedAt === null) {
    redirect('/onboarding');
  }

  return null;
}
