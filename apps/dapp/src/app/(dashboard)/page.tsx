import Page from '@/components/page';

import { OFFERINGS } from '@/offerings';

import { OnboardingGuard } from './_components/onboarding-guard';
import AumHeader from './_home/aum-header';
import OfferingCard from './_home/offering-card';

// The listing itself is static registry data: the AUM figure streams in via
// StreamedAum so an indexer slowdown never blanks the app's entry page.
export default function HomePage() {
  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <AumHeader />

        <Page className="gap-6 lg:gap-8">
          <h1 className="font-heading! text-h5 text-primary lg:text-h4">Offerings</h1>

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-6 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {OFFERINGS.map((offering) => (
              <OfferingCard key={offering.slug} offering={offering} />
            ))}
          </div>
        </Page>
      </div>
    </>
  );
}
