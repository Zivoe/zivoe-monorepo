import { redirect } from 'next/navigation';

import { getOnboardedStatus } from '@/server/data/auth';

import OnboardingForm from './_components/onboarding-form';

export default async function OnboardingPage() {
  const { isOnboarded } = await getOnboardedStatus();
  if (isOnboarded) redirect('/');

  return (
    <div className="flex h-full flex-col items-center">
      <OnboardingForm />
    </div>
  );
}
