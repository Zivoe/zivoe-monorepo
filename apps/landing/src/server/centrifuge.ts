import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { fetchShareClassNavs, listShareClassKeys } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

const fetchHeroNavs = async (): Promise<Record<string, string>> => {
  const network = env.NEXT_PUBLIC_NETWORK;
  return fetchShareClassNavs({ network, shareClassKeys: listShareClassKeys(network) });
};

const cachedHeroNavs = nextCache(fetchHeroNavs, ['centrifuge-share-class-navs'], { revalidate: 30 });

/**
 * AUM per live share class from the shared catalog — the hero sums the map,
 * so the marketing number matches the dApp homepage. Fail-closed: the fetch
 * throws on any missing or unpriced class, and Sentry-captured failure
 * returns undefined so the hero hides the stat instead of rendering a partial
 * sum. The fetch throws inside the cache boundary on purpose: a failed
 * background revalidation then keeps serving the last good payload instead of
 * caching `undefined` over it.
 */
const getShareClassNavs = reactCache(async (): Promise<Record<string, string> | undefined> => {
  try {
    return await cachedHeroNavs();
  } catch (error) {
    // The keys distinguish "a new class is not indexed yet" from "the indexer
    // is down" — this read fails as one unit for the whole book.
    Sentry.captureException(error, {
      tags: { source: 'SERVER' },
      extra: { shareClassKeys: listShareClassKeys(env.NEXT_PUBLIC_NETWORK) }
    });
  }
});

// TODO: nothing reads this since the hero switched to hardcoded operating figures. Kept because the
// post-migration transparency work is expected to render live AUM again — revisit and delete this
// module if that lands somewhere else.
export const centrifuge = {
  getShareClassNavs
};
