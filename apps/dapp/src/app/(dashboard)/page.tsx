import Page from '@/components/page';

import { OFFERINGS } from '@/offerings';

import { OnboardingGuard } from './_components/onboarding-guard';
import AumHeader from './_offerings/aum-header';
import { getHomepageAum } from './_offerings/homepage-aum';
import OfferingCard from './_offerings/offering-card';

export default async function HomePage() {
  const { headlineAum, cardAums } = await getHomepageAum();

  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <AumHeader aum={headlineAum} />

        <Page className="gap-6 lg:gap-8">
          <h1 className="font-heading! text-h5 text-primary lg:text-h4">Offerings</h1>

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-6 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {OFFERINGS.map((offering) => (
              <OfferingCard key={offering.slug} offering={offering} aum={cardAums[offering.shareClass.key] ?? null} />
            ))}
          </div>
        </Page>
      </div>
    </>
  );
}
