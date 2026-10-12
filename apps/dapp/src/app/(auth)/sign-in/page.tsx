import { redirect } from 'next/navigation';

import { getAccessStatus, getUser } from '@/server/data/auth';

import { onboardedDestination, signInReturnUrl, withNext } from '@/lib/lighthouse';

import SignInForm from './_components/sign-in-form';

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | Array<string> }>;
}) {
  const next = signInReturnUrl((await searchParams).next);
  const { user } = await getUser();

  if (user) {
    const { requiredStep } = await getAccessStatus();
    redirect(requiredStep ? withNext(requiredStep, next) : onboardedDestination(next));
  }

  return (
    <div className="flex h-full flex-col items-center">
      <SignInForm next={next} />
    </div>
  );
}
