import { sumShareClassNavs } from '@zivoe/centrifuge-indexer';

import { getShareClassNavs } from '@/server/data/centrifuge-metrics';

import Page from '@/components/page';

import { OFFERINGS } from '@/offerings';

import { OnboardingGuard } from './_components/onboarding-guard';
import AumHeader from './_offerings/aum-header';
import OfferingCard from './_offerings/offering-card';

export default async function HomePage() {
  // One cached multi-class read: the headline sums the map, each card takes
  // its own entry. A failed read hides both instead of a partial sum, and an
  // empty book hides the headline instead of reading $0. Summed as bigint so
  // per-entry float conversion cannot drift the total.
  const navs = await getShareClassNavs();
  const headlineAumD18 = navs ? sumShareClassNavs(navs) : null;
  const headlineAum = headlineAumD18 === null ? null : Number(headlineAumD18) / 1e18;

  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <AumHeader aum={headlineAum} />

        <Page className="gap-6 lg:gap-8">
          <h1 className="font-heading! text-h5 text-primary lg:text-h4">Offerings</h1>

          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-6 lg:grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
            {OFFERINGS.map((offering) => {
              const navD18 = navs?.[offering.shareClass.key];
              return (
                <OfferingCard
                  key={offering.slug}
                  offering={offering}
                  aum={navD18 !== undefined ? Number(navD18) / 1e18 : null}
                />
              );
            })}
          </div>
        </Page>
      </div>
    </>
  );
}
