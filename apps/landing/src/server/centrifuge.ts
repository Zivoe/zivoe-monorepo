import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import {
  type ShareStatsPayload,
  fetchCurrentShareMetrics,
  getCentrifugeIndexerConfig,
  toShareStatsPayload
} from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

const fetchHeroMetrics = async (): Promise<ShareStatsPayload> => {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  // negativeYield30d is deliberately not alerted on while APY is unrendered —
  // the projection already nulls it; restore the daily reporter with APY.
  const { payload } = toShareStatsPayload(await fetchCurrentShareMetrics({ config }));

  return payload;
};

const cachedHeroMetrics = nextCache(fetchHeroMetrics, ['centrifuge-current-share-metrics'], { revalidate: 30 });

/**
 * Current Share Price / AUM / 30-day Trailing APY as the shared stats payload —
 * the exact projection the dApp renders, so the two apps cannot drift on
 * semantics (cache timing aside). Sentry-captured failure returns undefined so
 * the hero hides the stats instead of rendering wrong numbers. The fetch
 * throws inside the cache boundary on purpose: a failed background
 * revalidation then keeps serving the last good payload instead of caching
 * `undefined` over it.
 */
const getCurrentShareMetrics = reactCache(async (): Promise<ShareStatsPayload | undefined> => {
  try {
    return await cachedHeroMetrics();
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER' } });
  }
});

// TODO: nothing reads this since the hero switched to hardcoded operating figures. Kept because the
// post-migration transparency work is expected to render live AUM / share price again — revisit and
// delete this module if that lands somewhere else.
export const centrifuge = {
  getCurrentShareMetrics
};
