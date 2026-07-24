import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import {
  type ShareStatsPayload,
  fetchCurrentShareMetrics,
  fetchDailyTokenSnapshots,
  getCentrifugeIndexerConfig,
  rayToPercent,
  toShareStatsPayload
} from '@zivoe/centrifuge-indexer';

import { sharesToValueD18 } from '@/centrifuge/config';

import { env } from '@/env';

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
      else apy = rayToPercent(snapshot.yield30dComp365);
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

async function fetchCurrentMetrics(): Promise<ShareStatsPayload> {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const { payload, negativeYield30d } = toShareStatsPayload(await fetchCurrentShareMetrics({ config }));

  if (negativeYield30d !== null) reportNegativeYield({ yield30dComp365: negativeYield30d.toString() });

  return payload;
}

const cachedCurrentMetrics = nextCache(fetchCurrentMetrics, ['centrifuge-current-share-metrics'], { revalidate: 30 });

/**
 * Current Share Price / NAV / 30-day Trailing APY as the shared stats payload —
 * the same projection the landing hero renders — behind a 30-second cache, the
 * single current-metrics entry every dApp surface reads. Same error contract
 * as the daily snapshots: throw inside the cache, hide-and-capture outside.
 */
export const getCurrentShareMetrics = reactCache(async (): Promise<ShareStatsPayload | undefined> => {
  try {
    return await cachedCurrentMetrics();
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER' } });
  }
});
