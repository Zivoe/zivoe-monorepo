import { getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import Page from '@/components/page';

import { OFFERINGS } from '@/offerings';

import { OnboardingGuard } from './_components/onboarding-guard';
import AumHeader from './_home/aum-header';
import OfferingCard from './_home/offering-card';

export default async function HomePage() {
  // One share class exists, so its AUM is the whole book and its metrics are
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
              card's width instead of stretching across the row.

              The track floor sets both column thresholds at once, so it is
              raised only from lg up. 22rem alone let a third column in at a
              1136px viewport, at 352px a card; 26rem holds two columns until
              1328px, where three still give each card 416px. Below lg the
              floor stays 22rem — raising it there would collapse the 760-888px
              range to a single stretched card. */}
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
