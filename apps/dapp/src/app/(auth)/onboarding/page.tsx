import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { getOnboardedStatus } from '@/server/data/auth';
import { captureServerEvent } from '@/server/utils/analytics';

import { onboardedDestination, signInReturnUrl } from '@/lib/lighthouse';

import OnboardingForm from './_components/onboarding-form';

/** `next` is the validated page that sent the user here; they return to it (a Lighthouse page with a pass) once onboarded (lib/lighthouse.ts). */
export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | Array<string> }>;
}) {
  const next = signInReturnUrl((await searchParams).next);
  const { isOnboarded, user } = await getOnboardedStatus();

  if (!user) redirect('/sign-in');
  if (isOnboarded) redirect(onboardedDestination(next));

  after(() =>
    captureServerEvent({
      distinctId: user.id,
      event: 'onboarding:started'
    })
  );

  return (
    <div className="flex h-full flex-col items-center">
      <OnboardingForm next={next} />
    </div>
  );
}
