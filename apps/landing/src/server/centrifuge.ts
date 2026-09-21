import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { type ShareStatsPayload, fetchCurrentShareMetrics, toShareStatsPayload } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

// The landing is chain-agnostic: Token Price and NAV are hub-level facts, so
// the environment is all it needs.
const environment = env.NEXT_PUBLIC_CHAIN_ENV;

async function fetchCurrentMetrics(shareClassKey: string): Promise<ShareStatsPayload> {
  const { payload } = toShareStatsPayload(await fetchCurrentShareMetrics({ environment, shareClassKey }));
  return payload;
}

// The environment reaches the fetch through module state, not an argument, so
// it must be an explicit keyPart: deployments sharing a data cache must not
// share entries across environments. The share-class key argument is part of
// the key too, so entries split per class. 60 seconds matches the homepage's
// `revalidate` (app/page.tsx): the hero's figures move at most once a minute.
const cachedCurrentMetrics = nextCache(fetchCurrentMetrics, ['centrifuge-current-share-metrics', environment], {
  revalidate: 60
});

/**
 * Current Token Price and NAV for one share class as the stats payload the
 * dApp renders from (`toShareStatsPayload`), so the two surfaces cannot drift
 * on semantics. Same error contract as the dApp's reads: the fetch throws
 * inside the cache boundary, so a failed background revalidation keeps
 * serving the last good payload, and a Sentry-captured failure returns
 * undefined so the hero renders the metric as unavailable instead of a
 * wrong number.
 */
const getCurrentShareMetrics = reactCache(async (shareClassKey: string): Promise<ShareStatsPayload | undefined> => {
  try {
    return await cachedCurrentMetrics(shareClassKey);
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER' }, extra: { shareClassKey } });
  }
});

export const centrifuge = {
  getCurrentShareMetrics
};
