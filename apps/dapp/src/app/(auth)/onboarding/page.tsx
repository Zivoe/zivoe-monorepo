import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { getOnboardedStatus } from '@/server/data/auth';
import { captureServerEvent } from '@/server/utils/analytics';

import OnboardingForm from './_components/onboarding-form';

export default async function OnboardingPage() {
  const { isOnboarded, user } = await getOnboardedStatus();

  if (!user) redirect('/sign-in');
  if (isOnboarded) redirect('/');

  after(() =>
    captureServerEvent({
      distinctId: user.id,
      event: 'onboarding:started'
    })
  );

  return (
    <div className="flex h-full flex-col items-center">
      <OnboardingForm />
    </div>
  );
}
