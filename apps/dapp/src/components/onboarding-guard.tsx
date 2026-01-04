// import { type ReactNode, useEffect, useState } from 'react';
import { Suspense } from 'react';

import { redirect } from 'next/navigation';

import { verifyOnboarded } from '@/server/data/auth';

// TODO: optimization - after the AppShell refactor, move this to the (app) layout to only check onboarding status once
export default function OnboardingGuard() {
  return (
    <Suspense fallback={null}>
      <OnboardingGuardComponent />
    </Suspense>
  );
}

async function OnboardingGuardComponent() {
  const { isOnboarded } = await verifyOnboarded();
  if (!isOnboarded) redirect('/onboarding');

  return null;
}
