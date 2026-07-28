import { getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import Page from '@/components/page';

import { OFFERINGS } from '@/offerings';

import { OnboardingGuard } from './_components/onboarding-guard';
import AumHeader from './_home/aum-header';
import OfferingCard from './_home/offering-card';

export default async function HomePage() {
  // One share class exists, so its NAV is the whole book and its metrics are
  // every card's metrics. Both become per-Offering reads — AUM a sum — once
  // the Centrifuge module is parameterized by share class.
  const metrics = await getCurrentShareMetrics();
  const aum = metrics ? Number(metrics.navD18) / 1e18 : null;

  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <AumHeader aum={aum} />

        <Page className="gap-6 lg:gap-8">
          <h1 className="font-heading! text-h5 text-primary lg:text-h4">Offerings</h1>

          {/* auto-fill, not auto-fit: empty tracks stay, so a lone card keeps a
              card's width instead of stretching across the row. */}
          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-6">
            {OFFERINGS.map((offering) => (
              <OfferingCard key={offering.slug} offering={offering} apy={metrics?.apy ?? null} aum={aum} />
            ))}
          </div>
        </Page>
      </div>
    </>
  );
}
