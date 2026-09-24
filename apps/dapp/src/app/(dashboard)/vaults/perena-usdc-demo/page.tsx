import { type Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PERENA_DEMO } from '@/prototypes/perena/config';
import { PerenaDemoPage } from '@/prototypes/perena/demo-page';
import { isPerenaDemoEnabled } from '@/prototypes/perena/enabled';

import { OnboardingGuard } from '../../_components/onboarding-guard';

// Keep the environment check at request time, including preview promotions.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: `${PERENA_DEMO.name} Demo | Zivoe`,
  robots: { index: false, follow: false }
};

export default async function PerenaDemoRoute({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!isPerenaDemoEnabled()) notFound();
  const { view } = await searchParams;
  return (
    <>
      <OnboardingGuard />
      <PerenaDemoPage initialTab={view === 'redeem' ? 'redeem' : 'deposit'} />
    </>
  );
}
