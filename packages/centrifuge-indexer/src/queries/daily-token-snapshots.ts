import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../chains';
import { fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { getShareClassIdentity } from '../share-classes';

const DAILY_TOKEN_SNAPSHOTS_QUERY = graphql(`
  query DailyTokenSnapshots($tokenId: String!, $limit: Int!, $after: String) {
    tokenSnapshots(
      where: { id: $tokenId }
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
      after: $after
    ) {
      items {
        timestamp
        tokenPrice
        totalIssuance
        yield30dComp365
      }
      pageInfo {
        hasNextPage
        endCursor
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
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
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
 * oldest history instead of silently freezing the newest. Wallet history opts
 * into cursor pagination; `truncated` also flags missing or repeated cursors
 * and the safety bound, never presenting a partial walk as complete.
 */
export async function fetchDailyTokenSnapshots({
  environment,
  shareClassKey,
  fetchOptions,
  paginate = false
}: {
  environment: CentrifugeEnvironment;
  shareClassKey: string;
  fetchOptions?: RequestInit;
  /** Walk all pages for wallet history; existing chart consumers retain their bounded read. */
  paginate?: boolean;
}): Promise<{ snapshots: Array<DailyTokenSnapshot>; truncated: boolean }> {
  const shareClass = getShareClassIdentity({ environment, key: shareClassKey });

  const items: z.infer<typeof dataSchema>['tokenSnapshots']['items'] = [];
  let after: string | null = null;
  let truncated = false;
  const cursors = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const data: z.infer<typeof dataSchema> = await fetchCentrifugeIndexer({
      indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
      query: DAILY_TOKEN_SNAPSHOTS_QUERY,
      variables: { tokenId: shareClass.scId, limit: MAX_PAGE_LIMIT, after },
      dataSchema,
      fetchOptions
    });

    items.push(...data.tokenSnapshots.items);
    const info = data.tokenSnapshots.pageInfo;
    truncated = info.hasNextPage;
    if (!truncated || !paginate) break;
    if (!info.endCursor || cursors.has(info.endCursor)) break;
    cursors.add(info.endCursor);
    after = info.endCursor;
  }

  const byDay = new Map<number, DailyTokenSnapshot>();

  // Rows arrive newest first, so the first priced write per day wins — that is
  // the day's last priced row.
  for (const item of items) {
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
    truncated
  };
}
