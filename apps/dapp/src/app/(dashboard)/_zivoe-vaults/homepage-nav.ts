import { sumShareClassNavs } from '@zivoe/centrifuge-indexer';

import { getCurrentShareMetrics, getShareClassNavs } from '@/server/data/centrifuge-metrics';

import { ZIVOE_VAULTS } from '@/zivoe-vaults';

export type HomepageNav = {
  /** Whole-book NAV in USD — null hides the headline. */
  headlineNav: number | null;
  /** Per-card NAV in USD by share-class key — null renders that card's em dash. */
  cardNavs: Record<string, number | null>;
};

/**
 * Headline and per-card NAV from the one aggregated read. The headline stays
 * fail-closed — a partial or empty book renders as unavailable, never as a
 * partial sum or $0 — but when the aggregated read fails, each card falls
 * back to its own per-class metrics read, so one unpriced class cannot blank
 * every other Zivoe Vault's NAV.
 */
export async function getHomepageNav(): Promise<HomepageNav> {
  const navs = await getShareClassNavs();

  if (navs) {
    const headlineNavD18 = sumShareClassNavs(navs);
    return {
      headlineNav: headlineNavD18 === null ? null : Number(headlineNavD18) / 1e18,
      cardNavs: Object.fromEntries(
        ZIVOE_VAULTS.map((zivoeVault) => {
          const navD18 = navs[zivoeVault.shareClass.key];
          return [zivoeVault.shareClass.key, navD18 === undefined ? null : Number(navD18) / 1e18];
        })
      )
    };
  }

  const perClass = await Promise.all(
    ZIVOE_VAULTS.map(async (zivoeVault) => {
      const metrics = await getCurrentShareMetrics(zivoeVault.shareClass.key);
      return [zivoeVault.shareClass.key, metrics ? Number(metrics.navD18) / 1e18 : null] as const;
    })
  );

  return { headlineNav: null, cardNavs: Object.fromEntries(perClass) };
}
