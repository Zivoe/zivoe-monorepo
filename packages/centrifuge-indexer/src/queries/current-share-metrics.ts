import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../chains';
import { CentrifugeIndexerError, fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { getShareClassIdentity } from '../share-classes';
import { navD18, rayToPercent } from '../units';
import { requireAgreeingTokenRows } from './token-rows';

// Filtered by tokenId (the hub-level share-class id), not by token address:
// addresses are per-chain facts, while these metrics are hub-level and must
// not depend on which chains the class happens to be instantiated on.
const CURRENT_SHARE_METRICS_QUERY = graphql(`
  query CurrentShareMetrics($tokenId: String!) {
    tokenInstances(where: { tokenId: $tokenId }) {
      items {
        token {
          tokenPrice
          tokenPriceComputedAt
          totalIssuance
          decimals
        }
      }
    }
    tokenSnapshots(where: { id: $tokenId }, orderBy: "timestamp", orderDirection: "desc", limit: 1) {
      items {
        yield30dComp365
      }
    }
  }
`);

const integerString = z.string().regex(/^\d+$/);
const positiveIntegerString = z.string().regex(/^\d*[1-9]\d*$/);
// The trailing yield can legitimately serialize negative (a Share Price decline
// over the window); the other fields never do.
const signedIntegerString = z.string().regex(/^-?\d+$/);

// Stricter than the schema's nullability on purpose: a token with no published
// price/issuance is not usable data — fail loudly instead of rendering zeros.
const dataSchema = z.object({
  tokenSnapshots: z.object({
    items: z.array(z.object({ yield30dComp365: signedIntegerString.nullable() }))
  }),
  tokenInstances: z.object({
    items: z.array(
      z.object({
        token: z.object({
          tokenPrice: positiveIntegerString,
          tokenPriceComputedAt: integerString,
          totalIssuance: integerString,
          decimals: z.number().int().nonnegative()
        })
      })
    )
  })
}) satisfies z.ZodType<ResultOf<typeof CURRENT_SHARE_METRICS_QUERY>>;

export type CurrentShareMetrics = {
  /** Manager-published Share Price in USD, 18 decimals. */
  sharePrice: bigint;
  /** Total share issuance in share-token base units. */
  totalIssuance: bigint;
  /** Share-class NAV in USD, 18 decimals (sharePrice x totalIssuance). */
  nav: bigint;
  shareTokenDecimals: number;
  /** When the manager last published the Share Price — the staleness signal. */
  priceComputedAt: Date;
  /**
   * 30-day trailing compound yield annualized over 365 days, Ray (1e27);
   * null until 30 days of performance history exist. Negative when the Share
   * Price declined over the window — consumers decide how to render that.
   */
  yield30dComp365: bigint | null;
};

export type ShareStatsPayload = {
  /** Manager-published Share Price in USD, 18 decimals, as a decimal string. */
  sharePriceD18: string;
  /** Share-class NAV in USD, 18 decimals, as a decimal string. */
  navD18: string;
  /** 30-day Trailing APY in percent; null until 30 days of history exist or when the yield is anomalous. */
  apy: number | null;
  /** When the manager last published the Share Price (ms since epoch) — the staleness signal. */
  priceComputedAtMs: number;
};

/**
 * The one JSON-plain projection of current share metrics that every stats
 * surface (dApp and landing) renders from, so the apps cannot drift on
 * semantics. D18 values travel as strings because Next's cache layers
 * JSON-serialize payloads. A negative trailing yield (a Share Price decline
 * over the window) is treated as anomalous: the payload carries a null APY
 * and `negativeYield30d` carries the raw value so callers can report it.
 */
export function toShareStatsPayload(metrics: CurrentShareMetrics): {
  payload: ShareStatsPayload;
  negativeYield30d: bigint | null;
} {
  const isNegative = metrics.yield30dComp365 !== null && metrics.yield30dComp365 < 0n;

  return {
    payload: {
      sharePriceD18: metrics.sharePrice.toString(),
      navD18: metrics.nav.toString(),
      apy: metrics.yield30dComp365 === null || isNegative ? null : rayToPercent(metrics.yield30dComp365),
      priceComputedAtMs: metrics.priceComputedAt.getTime()
    },
    negativeYield30d: isNegative ? metrics.yield30dComp365 : null
  };
}

/**
 * Creates a per-process reporter for the live negative-yield anomaly. Current
 * metrics revalidate frequently, so a persistent anomaly reports at most once
 * per UTC day — per share class, so one class's anomaly can never suppress
 * another's on a multi-class book.
 */
export function createDailyNegativeYieldReporter(
  report: (ctx: { shareClassKey: string; negativeYield30d: bigint }) => void
) {
  const lastReportedUtcDayByClass = new Map<string, string>();

  return ({
    shareClassKey,
    negativeYield30d,
    now = new Date()
  }: {
    shareClassKey: string;
    negativeYield30d: bigint | null;
    now?: Date;
  }): void => {
    if (negativeYield30d === null) return;

    const utcDay = now.toISOString().slice(0, 10);
    if (lastReportedUtcDayByClass.get(shareClassKey) === utcDay) return;

    lastReportedUtcDayByClass.set(shareClassKey, utcDay);
    report({ shareClassKey, negativeYield30d });
  };
}

export async function fetchCurrentShareMetrics({
  environment,
  shareClassKey,
  fetchOptions
}: {
  environment: CentrifugeEnvironment;
  shareClassKey: string;
  fetchOptions?: RequestInit;
}): Promise<CurrentShareMetrics> {
  const shareClass = getShareClassIdentity({ environment, key: shareClassKey });

  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
    query: CURRENT_SHARE_METRICS_QUERY,
    variables: { tokenId: shareClass.scId },
    dataSchema,
    fetchOptions
  });

  const token = requireAgreeingTokenRows({
    rows: data.tokenInstances.items.map((item) => item.token),
    conflictError: () =>
      new CentrifugeIndexerError({
        kind: 'validation',
        message: `The indexer returned conflicting share-token rows for "${shareClass.key}" on ${environment}.`
      })
  });
  if (!token)
    throw new CentrifugeIndexerError({
      kind: 'validation',
      message: `Share class "${shareClass.key}" is not indexed on ${environment}.`
    });
  const sharePrice = BigInt(token.tokenPrice);
  const totalIssuance = BigInt(token.totalIssuance);
  const newestYield = data.tokenSnapshots.items[0]?.yield30dComp365 ?? null;

  return {
    sharePrice,
    totalIssuance,
    nav: navD18({ tokenPrice: sharePrice, totalIssuance, decimals: token.decimals }),
    shareTokenDecimals: token.decimals,
    priceComputedAt: new Date(Number(token.tokenPriceComputedAt)),
    yield30dComp365: newestYield === null ? null : BigInt(newestYield)
  };
}
