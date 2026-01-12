import { Suspense } from 'react';

import { verifyOnboarded } from '@/server/data/auth';

export function OnboardingGuard() {
  return (
    <Suspense fallback={null}>
      <OnboardingCheck />
    </Suspense>
  );
}

async function OnboardingCheck() {
  await verifyOnboarded();
  return null;
}
