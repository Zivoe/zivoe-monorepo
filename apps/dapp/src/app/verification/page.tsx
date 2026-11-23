import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { isSupportedCountryCode } from '@/types/countries';

import { hasAcceptedAgreements } from '@/server/data/agreements';
import { getTermsStatus, getUser } from '@/server/data/auth';
import { getInvestorProfile } from '@/server/data/investor-profile';
import { organizations } from '@/server/organizations';
import { verification } from '@/server/verification';
import { isKycEnabled } from '@/server/verification/kyc-flag';
import { isYesDecision } from '@/server/verification/verification-status';
import { walletLink } from '@/server/wallet-link';
import { toLinkedAddress } from '@/server/wallet-link/wallet-link-view';

import { getQueryClient } from '@/lib/get-query-client';
import { withNext } from '@/lib/lighthouse';
import { queryKeys } from '@/lib/query-keys';
import { verificationReturnPath } from '@/lib/return-paths';

import { type SubjectOption } from './account-switcher';
import VerificationFlow from './verification-flow';
import { currentStepFor } from './verification-steps';

export const metadata: Metadata = { title: 'Verification | Zivoe' };

/**
 * The verification destination, in a shell of its own (no dashboard
 * navigation): the selected account's details, the agreements, the Persona flow, then Wallets.
 * The URL holds the state: `subject` names who (the person themselves when
 * absent), read against the viewer's own list, so an id of anything else
 * goes back to the plain page; `step` asks for `details`, `agreements` or `identity`. A subject whose
 * verification can still start opens on its details. Requires a session, the
 * current terms accepted and a completed onboarding profile: the existing
 * redirects, not a KYC guard. Behind the `kyc` flag: a 404 for anyone it is off for.
 */
export default async function VerificationPage({
  searchParams
}: {
  searchParams: Promise<{ subject?: string | Array<string>; step?: string | Array<string> }>;
}) {
  const { subject, step } = await searchParams;
  // Where sign-in, the terms and onboarding hand the user back to: this subject, when the URL named one.
  const returnTo = verificationReturnPath(subject);

  // Signed out (the proxy catches a missing cookie; this, an expired session): back here after sign-in.
  const { user } = await getUser();
  if (!user) redirect(withNext('/sign-in', returnTo));

  if (!(await isKycEnabled({ user }))) notFound();

  const [profile, termsStatus, memberships] = await Promise.all([
    getInvestorProfile({ userId: user.id }),
    getTermsStatus(user.id),
    organizations.listForUser({ userId: user.id })
  ]);
  // Behind on the terms: accept them first; the terms page hands the user back here.
  if (termsStatus !== 'accepted') redirect(withNext('/terms', returnTo));
  // No profile row means onboarding isn't finished; it hands the user back here.
  if (!profile) redirect(withNext('/onboarding', returnTo));

  const viewOf = (subjectId: string) => verification.getVerificationStatus({ subjectId, viewerUserId: user.id });
  const [personalView, ...organizationViews] = await Promise.all([
    viewOf(user.id),
    ...memberships.map((membership) => viewOf(membership.id))
  ]);
  const subjects: Array<SubjectOption> = [
    { id: user.id, name: `${profile.firstName} ${profile.lastName}`, view: personalView, organization: null },
    ...memberships.map((membership, index) => ({
      id: membership.id,
      name: membership.name,
      view: organizationViews[index] ?? personalView,
      organization: {
        name: membership.name,
        countryOfIncorporation: membership.countryOfIncorporation,
        title: membership.title
      }
    }))
  ];

  // A subject that isn't one of theirs (left, deleted, mistyped): the plain page, rather than their own
  // verification under someone else's id in the URL.
  if (subject !== undefined && !subjects.some((option) => option.id === subject)) redirect('/verification');
  const active = subjects.find((option) => option.id === subject) ?? subjects[0];
  // The person themselves is always first: never empty.
  if (!active) notFound();

  const hasAccepted = await hasAcceptedAgreements({ subjectId: active.id });
  const country = active.organization ? active.organization.countryOfIncorporation : profile.countryOfResidence;
  const currentStep = currentStepFor({
    requested: typeof step === 'string' ? step : undefined,
    canStart: active.view.canStart,
    hasCountry: isSupportedCountryCode(country ?? ''),
    hasAccepted,
    isYesDecision: isYesDecision(active.view)
  });

  // The subject's Linked addresses, read here into the cache the Wallets step
  // reads and writes: it renders without a loading state and needs no refresh
  // after a request. `fetchQuery`, not `prefetchQuery`: requests that cannot be
  // read are this page's error, not an empty step. Nothing can be linked before
  // a yes Decision, so nothing is read before one.
  const queryClient = getQueryClient();
  if (currentStep === 'wallets') {
    await queryClient.fetchQuery({
      queryKey: queryKeys.app.walletLinks({ subjectId: active.id }),
      queryFn: async () => (await walletLink.listLinks({ subjectId: active.id })).map(toLinkedAddress)
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VerificationFlow
        subjects={subjects}
        activeId={active.id}
        step={currentStep}
        hasAcceptedAgreements={hasAccepted}
        profile={profile}
      />
    </HydrationBoundary>
  );
}
