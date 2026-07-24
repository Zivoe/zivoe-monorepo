import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import {
  type ShareStatsPayload,
  createDailyNegativeYieldReporter,
  fetchCurrentShareMetrics,
  getCentrifugeIndexerConfig,
  toShareStatsPayload
} from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

const reportNegativeYield = createDailyNegativeYieldReporter((negativeYield30d) => {
  Sentry.captureMessage('Centrifuge indexer reported a negative 30-day trailing yield', {
    level: 'warning',
    tags: { source: 'SERVER' },
    extra: { yield30dComp365: negativeYield30d.toString() }
  });
});

const fetchHeroMetrics = async (): Promise<ShareStatsPayload> => {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const { payload, negativeYield30d } = toShareStatsPayload(await fetchCurrentShareMetrics({ config }));

  // A negative trailing yield is technically possible but never expected for
  // this pool — the shared projection nulls it; this alert asks a human to look.
  reportNegativeYield({ negativeYield30d });

  return payload;
};

const cachedHeroMetrics = nextCache(fetchHeroMetrics, ['centrifuge-current-share-metrics'], { revalidate: 30 });

/**
 * Current Share Price / NAV / 30-day Trailing APY as the shared stats payload —
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

export const centrifuge = {
  getCurrentShareMetrics
};
