import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import {
  type ShareClassKey,
  type ShareStatsPayload,
  fetchCurrentShareMetrics,
  fetchDailyTokenSnapshots,
  fetchShareClassNavs,
  getShareClassIdentity,
  rayToPercent,
  toShareStatsPayload
} from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

import { sharesToValueD18 } from '@/centrifuge/config';
import { OFFERINGS } from '@/offerings';

export type CentrifugeDailySnapshot = {
  /** UTC start (ms) of the day whose close this point records. */
  timestampMs: number;
  /** Share Price in USD. */
  sharePrice: number;
  /** Share-class AUM in USD (price x issuance); null while the day's issuance is unpublished. */
  nav: number | null;
  /** 30-day Trailing APY in percent; null until 30 days of history exist. */
  apy: number | null;
};

/**
 * Raw close rows, JSON-plain because unstable_cache serializes payloads to
 * JSON — D18 values travel as strings.
 */
type RawDailySnapshot = {
  dayStartSeconds: number;
  tokenPriceD18: string;
  totalIssuanceD18: string | null;
  yield30dComp365Ray: string | null;
};

async function fetchDailySnapshotRows(shareClassKey: ShareClassKey): Promise<Array<RawDailySnapshot>> {
  const { snapshots, truncated } = await fetchDailyTokenSnapshots({
    network: env.NEXT_PUBLIC_NETWORK,
    shareClassKey
  });

  if (truncated)
    Sentry.captureMessage('Centrifuge daily snapshots hit the indexer page cap; oldest history is being dropped', {
      level: 'warning',
      tags: { source: 'SERVER' },
      extra: { shareClassKey }
    });

  // Negative-yield alerting (a streak-start warning lived here) is silenced
  // while no surface renders APY — restore it from git history when APY ships.

  return snapshots.map((snapshot) => ({
    dayStartSeconds: snapshot.dayStartSeconds,
    tokenPriceD18: snapshot.tokenPrice.toString(),
    totalIssuanceD18: snapshot.totalIssuance === null ? null : snapshot.totalIssuance.toString(),
    yield30dComp365Ray: snapshot.yield30dComp365 === null ? null : snapshot.yield30dComp365.toString()
  }));
}

/**
 * Closed days are immutable (snapshot rows are append-only), so history
 * revalidates far slower than the 30-second current-metrics entry — this TTL
 * only bounds how quickly a new close appears after UTC midnight. The
 * share-class key argument is part of the cache key (serialized by
 * unstable_cache), so entries split per share class.
 */
const cachedDailySnapshotRows = nextCache(fetchDailySnapshotRows, ['centrifuge-daily-snapshots'], { revalidate: 900 });

/**
 * Daily close series from pool creation onward — one point per closed UTC day
 * carrying that day's closing state. The current day is not in the series; the
 * chart overlays it live from the current-metrics payload. Sentry-captured
 * failure returns undefined so consumers hide the affected surface. The fetch
 * throws inside the cache boundary on purpose: a failed background
 * revalidation then keeps serving the last good payload instead of caching
 * `undefined` over it.
 */
export const getCentrifugeDailySnapshots = reactCache(
  async (shareClassKey: ShareClassKey): Promise<Array<CentrifugeDailySnapshot> | undefined> => {
    try {
      const shareClass = getShareClassIdentity({ network: env.NEXT_PUBLIC_NETWORK, key: shareClassKey });
      const rows = await cachedDailySnapshotRows(shareClassKey);

      return rows.map((row): CentrifugeDailySnapshot => {
        const yieldRay = row.yield30dComp365Ray === null ? null : BigInt(row.yield30dComp365Ray);

        // AUM needs issuance; a priced row without it still charts Token Price,
        // so the day maps through with a null nav instead of being dropped.
        const navD18 =
          row.totalIssuanceD18 === null
            ? null
            : sharesToValueD18({
                shares: BigInt(row.totalIssuanceD18),
                sharePrice: BigInt(row.tokenPriceD18),
                shareClass
              });

        return {
          timestampMs: row.dayStartSeconds * 1000,
          sharePrice: Number(row.tokenPriceD18) / 1e18,
          nav: navD18 === null ? null : Number(navD18) / 1e18,
          // The anomalous negative case renders as the null state.
          apy: yieldRay === null || yieldRay < 0n ? null : rayToPercent(yieldRay)
        };
      });
    } catch (error) {
      Sentry.captureException(error, { tags: { source: 'SERVER' }, extra: { shareClassKey } });
    }
  }
);

/** One multi-class query over the given share classes — the aggregated surfaces' single read. */
async function fetchAggregatedNavRows(shareClassKeys: Array<string>): Promise<Record<string, string>> {
  return fetchShareClassNavs({ network: env.NEXT_PUBLIC_NETWORK, shareClassKeys });
}

const cachedShareClassNavs = nextCache(fetchAggregatedNavRows, ['centrifuge-share-class-navs'], { revalidate: 30 });

/**
 * AUM per listed share class, keyed by share-class key (18-decimal USD decimal
 * strings). The keys come from the registry rather than the catalog so the
 * headline is the sum of exactly the cards the page lists — a class the dApp
 * does not serve cannot inflate the aggregate — and the array argument keys
 * the cache, so a registry change starts a fresh entry. Fail-closed end to
 * end: the fetch throws if any class is missing or unpriced, and a failed
 * read returns undefined here so consumers hide the aggregate rather than
 * rendering a partial sum. Same error contract as the other reads: throw
 * inside the cache, hide-and-capture outside.
 */
export const getShareClassNavs = reactCache(async (): Promise<Record<string, string> | undefined> => {
  try {
    return await cachedShareClassNavs(OFFERINGS.map((offering) => offering.shareClass.key));
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER' } });
  }
});

async function fetchCurrentMetrics(shareClassKey: ShareClassKey): Promise<ShareStatsPayload> {
  // negativeYield30d is deliberately not alerted on while APY is unrendered —
  // the projection already nulls it; restore the daily reporter with APY.
  const { payload } = toShareStatsPayload(
    await fetchCurrentShareMetrics({ network: env.NEXT_PUBLIC_NETWORK, shareClassKey })
  );

  return payload;
}

const cachedCurrentMetrics = nextCache(fetchCurrentMetrics, ['centrifuge-current-share-metrics'], { revalidate: 30 });

/**
 * Current Share Price / AUM / 30-day Trailing APY for one share class as the
 * shared stats payload — the same projection the landing hero renders —
 * behind a 30-second cache entry per share class (the key argument splits
 * the entries). Same error contract as the daily snapshots: throw inside the
 * cache, hide-and-capture outside.
 */
export const getCurrentShareMetrics = reactCache(
  async (shareClassKey: ShareClassKey): Promise<ShareStatsPayload | undefined> => {
    try {
      return await cachedCurrentMetrics(shareClassKey);
    } catch (error) {
      Sentry.captureException(error, { tags: { source: 'SERVER' }, extra: { shareClassKey } });
    }
  }
);
