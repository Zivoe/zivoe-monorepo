import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { fetchShareClassNavs, listShareClassKeys } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

// The landing is chain-agnostic: NAV and the indexer are hub-level facts, so
// the environment is all it needs.
const environment = env.NEXT_PUBLIC_CHAIN_ENV;

const fetchHeroNavs = async (): Promise<Record<string, string>> => {
  return fetchShareClassNavs({ environment, shareClassKeys: listShareClassKeys(environment) });
};

const cachedHeroNavs = nextCache(fetchHeroNavs, ['centrifuge-share-class-navs'], { revalidate: 30 });

/**
 * NAV per live share class from the shared catalog. Note the dApp homepage
 * sums the REGISTRY's book instead; a dApp-side invariant keeps the two books
 * equal, and a landing-only build never runs it — so treat catalog flag flips
 * as dApp-gated, and never assume this sum matches the dApp's by construction.
 *
 * Fail-closed: the fetch throws on any missing or unpriced class, and a
 * Sentry-captured failure returns undefined so the hero hides the stat
 * instead of rendering a partial sum. The fetch throws inside the cache
 * boundary on purpose: a failed background revalidation then keeps serving
 * the last good payload instead of caching `undefined` over it.
 */
const getShareClassNavs = reactCache(async (): Promise<Record<string, string> | undefined> => {
  try {
    return await cachedHeroNavs();
  } catch (error) {
    // The keys distinguish "a new class is not indexed yet" from "the indexer
    // is down" — this read fails as one unit for the whole book.
    Sentry.captureException(error, {
      tags: { source: 'SERVER' },
      extra: { shareClassKeys: listShareClassKeys(environment) }
    });
  }
});

// TODO: nothing reads this since the hero switched to hardcoded operating figures. Kept because the
// post-migration transparency work is expected to render live NAV again — revisit and delete this
// module if that lands somewhere else.
export const centrifuge = {
  getShareClassNavs
};
