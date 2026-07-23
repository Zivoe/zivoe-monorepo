import { z } from 'zod';

import { type CentrifugeIndexerConfig } from '../config';
import { CentrifugeIndexerError, fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';

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
