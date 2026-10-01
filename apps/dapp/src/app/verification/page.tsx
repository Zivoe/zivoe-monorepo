import { type Metadata } from 'next';
import { redirect } from 'next/navigation';

import { verifySession } from '@/server/data/auth';
import { getInvestorProfile } from '@/server/data/investor-profile';
import { kycVerification } from '@/server/kyc';

import VerificationFlow from './verification-flow';

export const metadata: Metadata = { title: 'Identity verification | Zivoe' };

/**
 * The verification destination, in a shell of its own (no dashboard
 * navigation): the Investor Profile step, then the Persona flow. Requires a
 * session and a completed onboarding profile — the existing onboarding
 * redirect, not a KYC guard: nothing here ever redirects for KYC reasons,
 * and no wallet is needed. The profile read doubles as the onboarding check
 * (a profile row is what "onboarded" means), so the page waits on one round
 * of parallel reads after the session instead of two.
 */
export default async function KycPage() {
  const { user } = await verifySession();
  const [view, profile] = await Promise.all([
    kycVerification.getKycStatus({ userId: user.id }),
    getInvestorProfile({ userId: user.id })
  ]);
  // No profile row means onboarding isn't finished.
  if (!profile) redirect('/onboarding');

  return <VerificationFlow view={view} profile={profile} />;
}
