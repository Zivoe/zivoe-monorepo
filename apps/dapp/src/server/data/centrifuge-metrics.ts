import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import {
  fetchCurrentShareMetrics,
  fetchDailyTokenSnapshots,
  getCentrifugeIndexerConfig
} from '@zivoe/centrifuge-indexer';

import { sharesToValueD18 } from '@/centrifuge/config';

import { env } from '@/env';

// Ray (1e27) yields: dividing by 1e25 gives percent.
const RAY_PER_PERCENT = 1e25;

export type CentrifugeDailySnapshot = {
  timestampMs: number;
  /** Share Price in USD. */
  sharePrice: number;
  /** Share-class NAV in USD (price x issuance). */
  nav: number;
  /** 30-day Trailing APY in percent; null until 30 days of history exist. */
  apy: number | null;
};

/**
 * A negative trailing yield (a Share Price decline over the window) is
 * technically possible but never expected for this pool — the UI renders the
 * null state and this alert asks a human to look.
 */
function reportNegativeYield(extra: Record<string, string | number>) {
  Sentry.captureMessage('Centrifuge indexer reported a negative 30-day trailing yield', {
    level: 'warning',
    tags: { source: 'SERVER' },
    extra
  });
}

async function fetchDailySnapshots(): Promise<Array<CentrifugeDailySnapshot>> {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const { snapshots, truncated } = await fetchDailyTokenSnapshots({ config });

  if (truncated)
    Sentry.captureMessage('Centrifuge daily snapshots hit the indexer page cap; oldest history is being dropped', {
      level: 'warning',
      tags: { source: 'SERVER' }
    });

  let negativeYieldDays = 0;

  const daily = snapshots.flatMap((snapshot): Array<CentrifugeDailySnapshot> => {
    // NAV needs issuance; a priced row without it cannot chart.
    if (snapshot.totalIssuance === null) return [];

    let apy: number | null = null;
    if (snapshot.yield30dComp365 !== null) {
      if (snapshot.yield30dComp365 < 0n) negativeYieldDays += 1;
      else apy = Number(snapshot.yield30dComp365) / RAY_PER_PERCENT;
    }

    const navD18 = sharesToValueD18({ shares: snapshot.totalIssuance, sharePrice: snapshot.tokenPrice });

    return [
      {
        timestampMs: snapshot.dayStartSeconds * 1000,
        sharePrice: Number(snapshot.tokenPrice) / 1e18,
        nav: Number(navD18) / 1e18,
        apy
      }
    ];
  });

  if (negativeYieldDays > 0) reportNegativeYield({ negativeYieldDays });

  return daily;
}

const cachedDailySnapshots = nextCache(fetchDailySnapshots, ['centrifuge-daily-snapshots'], { revalidate: 60 });

/**
 * Daily token snapshots deduped to the last row per UTC day, from pool creation
 * onward — the chart window starts at migration by design. Sentry-captured
 * failure returns undefined so consumers hide the affected surface. The fetch
 * throws inside the cache boundary on purpose: a failed background
 * revalidation then keeps serving the last good payload instead of caching
 * `undefined` over it.
 */
export const getCentrifugeDailySnapshots = reactCache(
  async (): Promise<Array<CentrifugeDailySnapshot> | undefined> => {
    try {
      return await cachedDailySnapshots();
    } catch (error) {
      Sentry.captureException(error, { tags: { source: 'SERVER' } });
    }
  }
);

async function fetchCurrentMetrics(): Promise<{ sharePrice: number; nav: number; apy: number | null }> {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const metrics = await fetchCurrentShareMetrics({ config });

  let apy: number | null = null;
  if (metrics.yield30dComp365 !== null) {
    if (metrics.yield30dComp365 < 0n) reportNegativeYield({ yield30dComp365: metrics.yield30dComp365.toString() });
    else apy = Number(metrics.yield30dComp365) / RAY_PER_PERCENT;
  }

  return {
    sharePrice: Number(metrics.sharePrice) / 1e18,
    nav: Number(metrics.nav) / 1e18,
    apy
  };
}

const cachedCurrentMetrics = nextCache(fetchCurrentMetrics, ['centrifuge-current-share-metrics'], { revalidate: 60 });

/**
 * Seconds-fresh current Share Price / NAV / 30-day Trailing APY from the shared
 * current-share-metrics query — never last-snapshot-stale. Same error contract
 * as the daily snapshots: throw inside the cache, hide-and-capture outside.
 */
export const getCurrentShareMetrics = reactCache(
  async (): Promise<{ sharePrice: number; nav: number; apy: number | null } | undefined> => {
    try {
      return await cachedCurrentMetrics();
    } catch (error) {
      Sentry.captureException(error, { tags: { source: 'SERVER' } });
    }
  }
);
