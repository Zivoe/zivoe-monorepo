import { type Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getAgreementsAccess } from '@/server/data/agreements';
import { getAccessStatus } from '@/server/data/auth';

import { onboardedDestination, signInReturnUrl, withNext } from '@/lib/lighthouse';

import AgreementsGateForm from './_components/agreements-gate-form';

export const metadata: Metadata = { title: 'Agreements | Zivoe' };

/**
 * Where the dapp sends anyone who acts for an approved account (their own, or an organization's) without the
 * current agreements: a member of an approved organization who never accepted them, and everyone again each time
 * a deploy moves `LATEST_AGREEMENTS_VERSION` past their last acceptance. `/verification` asks for them in its own
 * step instead. `next` is the validated page that sent them here; they return to it once they accept.
 */
export default async function AgreementsPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | Array<string> }>;
}) {
  const next = signInReturnUrl((await searchParams).next);
  const { requiredStep, user } = await getAccessStatus();

  if (requiredStep !== '/agreements')
    redirect(requiredStep ? withNext(requiredStep, next) : onboardedDestination(next));

  // Only the wording depends on it: someone who accepted an earlier version is told the agreements changed.
  const isUpdate = (await getAgreementsAccess(user.id)).status === 'outdated';

  return (
    <div className="flex h-full flex-col items-center">
      <AgreementsGateForm next={next} isUpdate={isUpdate} />
    </div>
  );
}
