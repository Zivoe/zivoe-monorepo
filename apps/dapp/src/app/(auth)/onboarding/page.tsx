import { redirect } from 'next/navigation';

import { verifyOnboarded } from '@/server/data/auth';

import OnboardingComponent from './_components/onboarding-component';

export default async function OnboardingPage() {
  const { isOnboarded } = await verifyOnboarded();
  if (isOnboarded) redirect('/');

  return <OnboardingComponent />;
}
