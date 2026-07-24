import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { fetchCurrentShareMetrics, getCentrifugeIndexerConfig, rayToPercent } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

type HeroMetrics = { navD18: string; sharePriceD18: string; apy: number | null };

const fetchHeroMetrics = async (): Promise<HeroMetrics> => {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const metrics = await fetchCurrentShareMetrics({ config });

  // Mirrors the dApp: a negative trailing yield is technically possible but
  // never expected for this pool — render the null state and ask a human to look.
  let apy: number | null = null;
  if (metrics.yield30dComp365 !== null) {
    if (metrics.yield30dComp365 < 0n) {
      Sentry.captureMessage('Centrifuge indexer reported a negative 30-day trailing yield', {
        level: 'warning',
        tags: { source: 'SERVER' },
        extra: { yield30dComp365: metrics.yield30dComp365.toString() }
      });
    } else apy = rayToPercent(metrics.yield30dComp365);
  }

  // unstable_cache serializes to JSON, so bigints travel as strings.
  return {
    navD18: metrics.nav.toString(),
    sharePriceD18: metrics.sharePrice.toString(),
    apy
  };
};

const cachedHeroMetrics = nextCache(fetchHeroMetrics, ['centrifuge-current-share-metrics'], { revalidate: 60 });

/**
 * Seconds-fresh Share Price / NAV / 30-day Trailing APY from the shared
 * Centrifuge current-share-metrics query — the same source the dApp reads.
 * Sentry-captured failure returns undefined so the hero hides the stats
 * instead of rendering wrong numbers. The fetch throws inside the cache
 * boundary on purpose: a failed background revalidation then keeps serving
 * the last good payload instead of caching `undefined` over it.
 */
const getCurrentShareMetrics = reactCache(async (): Promise<HeroMetrics | undefined> => {
  try {
    return await cachedHeroMetrics();
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER' } });
  }
});

export const centrifuge = {
  getCurrentShareMetrics
};
