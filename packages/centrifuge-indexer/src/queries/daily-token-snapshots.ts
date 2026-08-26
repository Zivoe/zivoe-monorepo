import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../chains';
import { fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { getShareClassIdentity } from '../share-classes';

const DAILY_TOKEN_SNAPSHOTS_QUERY = graphql(`
  query DailyTokenSnapshots($tokenId: String!, $limit: Int!) {
    tokenSnapshots(where: { id: $tokenId }, orderBy: "timestamp", orderDirection: "desc", limit: $limit) {
      items {
        timestamp
        tokenPrice
        totalIssuance
        yield30dComp365
      }
    }
  }
`);

const integerString = z.string().regex(/^\d+$/);
// The trailing yield can legitimately serialize negative (a Share Price
// decline over the window); the other fields never do.
const signedIntegerString = z.string().regex(/^-?\d+$/);

const dataSchema = z.object({
  tokenSnapshots: z.object({
    items: z.array(
      z.object({
        timestamp: integerString,
        tokenPrice: integerString.nullable(),
        totalIssuance: integerString.nullable(),
        yield30dComp365: signedIntegerString.nullable()
      })
    )
  })
}) satisfies z.ZodType<ResultOf<typeof DAILY_TOKEN_SNAPSHOTS_QUERY>>;

export type DailyTokenSnapshot = {
  /** UTC day start (seconds) of the day this row's state belongs to — the dedupe bucket key. */
  dayStartSeconds: number;
  /** Share Price in USD, 18 decimals. */
  tokenPrice: bigint;
  /** Total share issuance in share-token base units; null when unpublished. */
  totalIssuance: bigint | null;
  /**
   * 30-day trailing compound yield annualized, Ray (1e27); may be negative;
   * null until 30 days of performance history exist.
   */
  yield30dComp365: bigint | null;
};

/** The indexer server rejects pages larger than 1000 rows. */
const MAX_PAGE_LIMIT = 1000;

export function getUtcDayStartSeconds(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Daily token snapshots deduped to the last priced row per UTC day, oldest
 * first — where a row belongs to the day it *describes*: `NewPeriod` rows are
 * stamped exactly at UTC midnight with the state at rollover (the previous
 * day's close), so bucketing keys on the instant just before each snapshot.
 * Each closed day therefore carries its closing state, and the current day has
 * no row until it closes (intraday price-publication events do add same-day
 * rows). Fetched newest-first so hitting the indexer's page cap drops the
 * oldest history instead of silently freezing the newest; `truncated` flags
 * that case so callers can alert and move to cursor pagination (`after` /
 * `pageInfo` exist on the endpoint) before history is actually lost.
 */
export async function fetchDailyTokenSnapshots({
  environment,
  shareClassKey,
  fetchOptions
}: {
  environment: CentrifugeEnvironment;
  shareClassKey: string;
  fetchOptions?: RequestInit;
}): Promise<{ snapshots: Array<DailyTokenSnapshot>; truncated: boolean }> {
  const shareClass = getShareClassIdentity({ environment, key: shareClassKey });

  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
    query: DAILY_TOKEN_SNAPSHOTS_QUERY,
    variables: { tokenId: shareClass.scId, limit: MAX_PAGE_LIMIT },
    dataSchema,
    fetchOptions
  });

  const byDay = new Map<number, DailyTokenSnapshot>();

  // Rows arrive newest first, so the first priced write per day wins — that is
  // the day's last priced row.
  for (const item of data.tokenSnapshots.items) {
    if (item.tokenPrice === null) continue;

    // The instant just before the snapshot: a midnight-stamped NewPeriod row
    // records the previous day's close, an intraday row stays on its own day.
    const dayStartSeconds = getUtcDayStartSeconds(Number(item.timestamp) - 1);
    if (byDay.has(dayStartSeconds)) continue;

    byDay.set(dayStartSeconds, {
      dayStartSeconds,
      tokenPrice: BigInt(item.tokenPrice),
      totalIssuance: item.totalIssuance === null ? null : BigInt(item.totalIssuance),
      yield30dComp365: item.yield30dComp365 === null ? null : BigInt(item.yield30dComp365)
    });
  }

  return {
    snapshots: [...byDay.values()].sort((a, b) => a.dayStartSeconds - b.dayStartSeconds),
    truncated: data.tokenSnapshots.items.length === MAX_PAGE_LIMIT
  };
}
