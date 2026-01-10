import { redirect } from 'next/navigation';

import { getOnboardedStatus, getUser } from '@/server/data/auth';

import SignInForm from './_components/sign-in-form';

export default async function SignInPage() {
  const { user } = await getUser();

  if (user) {
    const { isOnboarded } = await getOnboardedStatus();
    redirect(isOnboarded ? '/' : '/onboarding');
  }

  return (
    <div className="flex h-full flex-col items-center">
      <SignInForm />
    </div>
  );
}
