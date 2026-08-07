import { getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import Page from '@/components/page';

import { OFFERINGS } from '@/offerings';

import { OnboardingGuard } from './_components/onboarding-guard';
import AumHeader from './_offerings/aum-header';
import OfferingCard from './_offerings/offering-card';

export default async function HomePage() {
  // One share class exists, so its AUM is the whole book and its metrics are
  // every card's metrics. Both become per-Offering reads — AUM a sum — once
  // the aggregated metrics map lands.
  const metrics = await getCurrentShareMetrics('zmca');
  const aum = metrics ? Number(metrics.navD18) / 1e18 : null;

  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <AumHeader aum={aum} />

        <Page className="gap-6 lg:gap-8">
          <h1 className="font-heading! text-h5 text-primary lg:text-h4">Offerings</h1>

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-6 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {OFFERINGS.map((offering) => (
              <OfferingCard key={offering.slug} offering={offering} aum={aum} />
            ))}
          </div>
        </Page>
      </div>
    </>
  );
}
