import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { fetchCurrentShareMetrics, getCentrifugeIndexerConfig } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

const fetchHeroMetrics = async (): Promise<{ navD18: string; sharePriceD18: string }> => {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const metrics = await fetchCurrentShareMetrics({ config });

  // unstable_cache serializes to JSON, so bigints travel as strings.
  return {
    navD18: metrics.nav.toString(),
    sharePriceD18: metrics.sharePrice.toString()
  };
};

const cachedHeroMetrics = nextCache(fetchHeroMetrics, ['centrifuge-current-share-metrics'], { revalidate: 60 });

/**
 * Seconds-fresh Share Price / NAV from the shared Centrifuge current-share-
 * metrics query — the same source the dApp reads. Sentry-captured failure
 * returns undefined so the hero hides the stat instead of rendering wrong
 * numbers. The fetch throws inside the cache boundary on purpose: a failed
 * background revalidation then keeps serving the last good payload instead of
 * caching `undefined` over it.
 */
const getCurrentShareMetrics = reactCache(async (): Promise<{ navD18: string; sharePriceD18: string } | undefined> => {
  try {
    return await cachedHeroMetrics();
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER' } });
  }
});

export const centrifuge = {
  getCurrentShareMetrics
};
