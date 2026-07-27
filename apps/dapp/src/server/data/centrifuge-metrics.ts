import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import {
  type ShareStatsPayload,
  createDailyNegativeYieldReporter,
  fetchCurrentShareMetrics,
  fetchDailyTokenSnapshots,
  getCentrifugeIndexerConfig,
  rayToPercent,
  toShareStatsPayload
} from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

import { sharesToValueD18 } from '@/centrifuge/config';

export type CentrifugeDailySnapshot = {
  /** UTC start (ms) of the day whose close this point records. */
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
 * null state and this alert asks a human to look. It must fire when the
 * anomaly APPEARS, not on every revalidation while immutable negative history
 * exists: the daily path alerts when a streak starts, and the live path at
 * most once per instance per UTC day.
 */
function reportNegativeYield(extra: Record<string, string | number>) {
  Sentry.captureMessage('Centrifuge indexer reported a negative 30-day trailing yield', {
    level: 'warning',
    tags: { source: 'SERVER' },
    extra
  });
}

const isNegativeYieldDay = (snapshot?: { yield30dComp365: bigint | null }): snapshot is { yield30dComp365: bigint } =>
  snapshot !== undefined && snapshot.yield30dComp365 !== null && snapshot.yield30dComp365 < 0n;

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

async function fetchDailySnapshotRows(): Promise<Array<RawDailySnapshot>> {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const { snapshots, truncated } = await fetchDailyTokenSnapshots({ config });

  if (truncated)
    Sentry.captureMessage('Centrifuge daily snapshots hit the indexer page cap; oldest history is being dropped', {
      level: 'warning',
      tags: { source: 'SERVER' }
    });

  // Closed rows are immutable, so any historical negative day would re-alert
  // on every revalidation forever. Only the newest close starting a negative
  // streak is news; snapshots arrive sorted ascending.
  const latest = snapshots.at(-1);
  if (isNegativeYieldDay(latest) && !isNegativeYieldDay(snapshots.at(-2)))
    reportNegativeYield({
      dayStartSeconds: latest.dayStartSeconds,
      yield30dComp365: latest.yield30dComp365.toString()
    });

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
 * only bounds how quickly a new close appears after UTC midnight.
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
export const getCentrifugeDailySnapshots = reactCache(async (): Promise<Array<CentrifugeDailySnapshot> | undefined> => {
  try {
    const rows = await cachedDailySnapshotRows();

    return rows.flatMap((row): Array<CentrifugeDailySnapshot> => {
      // NAV needs issuance; a priced row without it cannot chart.
      if (row.totalIssuanceD18 === null) return [];

      const yieldRay = row.yield30dComp365Ray === null ? null : BigInt(row.yield30dComp365Ray);
      const navD18 = sharesToValueD18({ shares: BigInt(row.totalIssuanceD18), sharePrice: BigInt(row.tokenPriceD18) });

      return [
        {
          timestampMs: row.dayStartSeconds * 1000,
          sharePrice: Number(row.tokenPriceD18) / 1e18,
          nav: Number(navD18) / 1e18,
          // The anomalous negative case renders as the null state.
          apy: yieldRay === null || yieldRay < 0n ? null : rayToPercent(yieldRay)
        }
      ];
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER' } });
  }
});

const reportLiveNegativeYield = createDailyNegativeYieldReporter((negativeYield30d) =>
  reportNegativeYield({ yield30dComp365: negativeYield30d.toString() })
);

async function fetchCurrentMetrics(): Promise<ShareStatsPayload> {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const { payload, negativeYield30d } = toShareStatsPayload(await fetchCurrentShareMetrics({ config }));

  reportLiveNegativeYield({ negativeYield30d });

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
