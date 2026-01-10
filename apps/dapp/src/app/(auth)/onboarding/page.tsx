import { redirect } from 'next/navigation';

import { getOnboardedStatus } from '@/server/data/auth';

import OnboardingForm from './_components/onboarding-form';

export default async function OnboardingPage() {
  const { isOnboarded, user } = await getOnboardedStatus();

  if (!user) redirect('/sign-in');
  if (isOnboarded) redirect('/');

  return (
    <div className="flex h-full flex-col items-center">
      <OnboardingForm />
    </div>
  );
}
