import { redirect } from 'next/navigation';

import { getAccessStatus, getTermsStatus } from '@/server/data/auth';

import { onboardedDestination, signInReturnUrl, withNext } from '@/lib/lighthouse';

import TermsForm from './_components/terms-form';

/**
 * Where a signed-in, onboarded user lands until they accept the current terms: right after onboarding, and
 * again each time `app_config.terms_updated_at` moves past their last acceptance. `next` is the validated
 * page that sent them here; they return to it once they accept (lib/lighthouse.ts).
 */
export default async function TermsPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | Array<string> }>;
}) {
  const next = signInReturnUrl((await searchParams).next);
  const { requiredStep, user } = await getAccessStatus();

  if (requiredStep !== '/terms') redirect(requiredStep ? withNext(requiredStep, next) : onboardedDestination(next));

  // Only the wording depends on it: a user who accepted an earlier version is told the terms changed.
  const isUpdate = (await getTermsStatus(user.id)) === 'outdated';

  return (
    <div className="flex h-full flex-col items-center">
      <TermsForm next={next} isUpdate={isUpdate} />
    </div>
  );
}
