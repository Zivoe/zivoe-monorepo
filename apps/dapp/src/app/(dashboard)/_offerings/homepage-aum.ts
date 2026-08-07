import { sumShareClassNavs } from '@zivoe/centrifuge-indexer';

import { OFFERINGS } from '@/offerings';

import { getCurrentShareMetrics, getShareClassNavs } from '@/server/data/centrifuge-metrics';

export type HomepageAum = {
  /** Whole-book AUM in USD — null hides the headline. */
  headlineAum: number | null;
  /** Per-card AUM in USD by share-class key — null renders that card's em dash. */
  cardAums: Record<string, number | null>;
};

/**
 * Headline and per-card AUM from the one aggregated read. The headline stays
 * fail-closed — a partial or empty book renders as unavailable, never as a
 * partial sum or $0 — but when the aggregated read fails, each card falls
 * back to its own per-class metrics read, so one unpriced class cannot blank
 * every other Offering's AUM.
 */
export async function getHomepageAum(): Promise<HomepageAum> {
  const navs = await getShareClassNavs();

  if (navs) {
    const headlineAumD18 = sumShareClassNavs(navs);
    return {
      headlineAum: headlineAumD18 === null ? null : Number(headlineAumD18) / 1e18,
      cardAums: Object.fromEntries(
        OFFERINGS.map((offering) => {
          const navD18 = navs[offering.shareClass.key];
          return [offering.shareClass.key, navD18 === undefined ? null : Number(navD18) / 1e18];
        })
      )
    };
  }

  const perClass = await Promise.all(
    OFFERINGS.map(async (offering) => {
      const metrics = await getCurrentShareMetrics(offering.shareClass.key);
      return [offering.shareClass.key, metrics ? Number(metrics.navD18) / 1e18 : null] as const;
    })
  );

  return { headlineAum: null, cardAums: Object.fromEntries(perClass) };
}
