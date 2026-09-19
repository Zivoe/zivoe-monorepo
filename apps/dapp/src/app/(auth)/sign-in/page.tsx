import { redirect } from 'next/navigation';

import { getOnboardedStatus, getUser } from '@/server/data/auth';

import { lighthouseReturnUrl, onboardedDestination, withNext } from '@/lib/lighthouse';

import SignInForm from './_components/sign-in-form';

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | Array<string> }>;
}) {
  const next = lighthouseReturnUrl((await searchParams).next);
  const { user } = await getUser();

  if (user) {
    const { isOnboarded } = await getOnboardedStatus();
    redirect(isOnboarded ? onboardedDestination(next) : withNext('/onboarding', next));
  }

  return (
    <div className="flex h-full flex-col items-center">
      <SignInForm next={next} />
    </div>
  );
}
