import { z } from 'zod';

import { type CentrifugeIndexerConfig } from '../config';
import { CentrifugeIndexerError, fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { rayToPercent } from '../units';

const CURRENT_SHARE_METRICS_QUERY = graphql(`
  query CurrentShareMetrics($shareTokenAddress: String!, $tokenId: String!) {
    tokenInstances(where: { address: $shareTokenAddress }) {
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
  /** Share-class AUM in USD, 18 decimals (sharePrice x totalIssuance). */
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
  /** Share-class AUM in USD, 18 decimals, as a decimal string. */
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
 * per UTC day instead of on every fetch.
 */
export function createDailyNegativeYieldReporter(report: (negativeYield30d: bigint) => void) {
  let lastReportedUtcDay: string | undefined;

  return ({ negativeYield30d, now = new Date() }: { negativeYield30d: bigint | null; now?: Date }): void => {
    if (negativeYield30d === null) return;

    const utcDay = now.toISOString().slice(0, 10);
    if (utcDay === lastReportedUtcDay) return;

    lastReportedUtcDay = utcDay;
    report(negativeYield30d);
  };
}

export async function fetchCurrentShareMetrics({
  config,
  fetchOptions
}: {
  config: CentrifugeIndexerConfig;
  fetchOptions?: RequestInit;
}): Promise<CurrentShareMetrics> {
  const data = await fetchCentrifugeIndexer({
    indexerUrl: config.indexerUrl,
    query: CURRENT_SHARE_METRICS_QUERY,
    variables: { shareTokenAddress: config.shareTokenAddress.toLowerCase(), tokenId: config.scId },
    dataSchema,
    fetchOptions
  });

  const token = data.tokenInstances.items[0]?.token;
  if (!token)
    throw new CentrifugeIndexerError({
      kind: 'validation',
      message: `Share token ${config.shareTokenAddress} is not indexed on ${config.network}.`
    });

  const sharePrice = BigInt(token.tokenPrice);
  const totalIssuance = BigInt(token.totalIssuance);
  const newestYield = data.tokenSnapshots.items[0]?.yield30dComp365 ?? null;

  return {
    sharePrice,
    totalIssuance,
    nav: (sharePrice * totalIssuance) / 10n ** BigInt(token.decimals),
    shareTokenDecimals: token.decimals,
    priceComputedAt: new Date(Number(token.tokenPriceComputedAt)),
    yield30dComp365: newestYield === null ? null : BigInt(newestYield)
  };
}
