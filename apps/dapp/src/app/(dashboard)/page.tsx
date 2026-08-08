import Page from '@/components/page';

import { OFFERINGS } from '@/offerings';

import { OnboardingGuard } from './_components/onboarding-guard';
import { getHomepageNav } from './_offerings/homepage-nav';
import NavHeader from './_offerings/nav-header';
import OfferingCard from './_offerings/offering-card';

export default async function HomePage() {
  const { headlineNav, cardNavs } = await getHomepageNav();

  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <NavHeader nav={headlineNav} />

        <Page className="gap-6 lg:gap-8">
          <h1 className="font-heading! text-h5 text-primary lg:text-h4">Offerings</h1>

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-6 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {OFFERINGS.map((offering) => (
              <OfferingCard key={offering.slug} offering={offering} nav={cardNavs[offering.shareClass.key] ?? null} />
            ))}
          </div>
        </Page>
      </div>
    </>
  );
}
