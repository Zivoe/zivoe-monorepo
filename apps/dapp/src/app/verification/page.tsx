import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getUser } from '@/server/data/auth';
import { getInvestorProfile } from '@/server/data/investor-profile';
import { kycVerification } from '@/server/kyc';
import { isKycEnabled } from '@/server/kyc/kyc-flag';

import { withNext } from '@/lib/lighthouse';

import VerificationFlow from './verification-flow';

export const metadata: Metadata = { title: 'Identity verification | Zivoe' };

/**
 * The verification destination, in a shell of its own (no dashboard
 * navigation): the Investor Profile step, then the Persona flow. Requires a
 * session and a completed onboarding profile — the existing onboarding
 * redirect, not a KYC guard: nothing here ever redirects for KYC reasons,
 * and no wallet is needed. The profile read doubles as the onboarding check
 * (a profile row is what "onboarded" means), so the page waits on one round
 * of parallel reads after the session instead of two. Behind the `kyc` flag:
 * a 404 for anyone it is off for.
 */
export default async function KycPage() {
  // Signed out (the proxy catches a missing cookie; this, an expired session): back here after sign-in.
  const { user } = await getUser();
  if (!user) redirect(withNext('/sign-in', '/verification'));

  if (!(await isKycEnabled({ user }))) notFound();

  const [view, profile] = await Promise.all([
    kycVerification.getKycStatus({ userId: user.id }),
    getInvestorProfile({ userId: user.id })
  ]);
  // No profile row means onboarding isn't finished; it hands the user back here.
  if (!profile) redirect(withNext('/onboarding', '/verification'));

  return <VerificationFlow view={view} profile={profile} />;
}
