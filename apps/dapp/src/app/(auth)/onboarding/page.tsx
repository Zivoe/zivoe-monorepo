import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { getAccessStatus } from '@/server/data/auth';
import { organizations } from '@/server/organizations';
import { captureServerEvent, getBrowserSessionId } from '@/server/utils/analytics';
import { isKycEnabled } from '@/server/verification/kyc-flag';

import { onboardedDestination, signInReturnUrl, withNext } from '@/lib/lighthouse';
import { isInvitationPath } from '@/lib/return-paths';

import OnboardingForm from './_components/onboarding-form';

/**
 * Onboarding, after the terms. `next` is the validated page that sent the user here; they return to it (a
 * Lighthouse page with a pass) once onboarded (lib/lighthouse.ts). Someone who came by an invitation link is
 * not asked how they will invest: the invitation is the answer.
 */
export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string | Array<string>; step?: string | Array<string> }>;
}) {
  const params = await searchParams;
  const next = signInReturnUrl(params.next);
  const { requiredStep, user } = await getAccessStatus();

  if (!user) redirect('/sign-in');
  // The invite step comes once onboarding is saved, and is in the URL from the moment it is asked for: a page
  // rendered again meanwhile (a refreshed session cookie, a reload) shows it, rather than sending them on.
  if (requiredStep === null && params.step === 'invite') {
    const organization = await organizations.latestCreatedBy({ userId: user.id });
    if (organization) {
      return (
        <div className="flex h-full flex-col items-center">
          <OnboardingForm next={next} canInvestThroughOrganization={false} inviteTo={organization} />
        </div>
      );
    }
  }
  if (requiredStep !== '/onboarding')
    redirect(requiredStep ? withNext(requiredStep, next) : onboardedDestination(next));

  // Organizations come with verification, behind the `kyc` flag.
  const canInvestThroughOrganization = !isInvitationPath(next) && (await isKycEnabled({ user }));

  // Read before after(), which cannot read headers here: see getBrowserSessionId.
  const sessionId = await getBrowserSessionId();
  after(() => captureServerEvent({ distinctId: user.id, event: 'onboarding:started', sessionId }));

  return (
    <div className="flex h-full flex-col items-center">
      <OnboardingForm next={next} canInvestThroughOrganization={canInvestThroughOrganization} />
    </div>
  );
}
