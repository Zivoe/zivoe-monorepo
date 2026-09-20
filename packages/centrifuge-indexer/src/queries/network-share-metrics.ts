import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment, getChainId } from '../chains';
import { CentrifugeIndexerError, fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { getShareClassIdentity, listLiveChains, listShareClassChainIdentities } from '../share-classes';

const NETWORK_SHARE_METRICS_QUERY = graphql(`
  query NetworkShareMetrics($tokenId: String!) {
    token(id: $tokenId) {
      id
      isActive
      poolId
      decimals
      totalIssuance
      tokenPrice
      tokenPriceComputedAt
      pool {
        currency
        decimals
      }
    }
    tokenInstances(where: { tokenId: $tokenId }, limit: 1000) {
      totalCount
      pageInfo {
        hasNextPage
      }
      items {
        centrifugeId
        tokenId
        address
        decimals
        totalIssuance
        tokenPrice
        computedAt
        blockchain {
          chainId
        }
      }
    }
    _meta {
      status
    }
  }
`);

const integer = z.string().regex(/^(0|[1-9]\d{0,77})$/);
const positiveInteger = integer.refine((value) => BigInt(value) > 0n);
const dataSchema = z.object({
  token: z.object({
    id: z.string(),
    isActive: z.literal(true),
    poolId: integer,
    decimals: z.number().int().min(0).max(18),
    totalIssuance: integer,
    tokenPrice: positiveInteger,
    tokenPriceComputedAt: positiveInteger,
    pool: z.object({ currency: z.literal('840'), decimals: z.literal(18) })
  }),
  tokenInstances: z.object({
    totalCount: z.number().int().positive(),
    pageInfo: z.object({ hasNextPage: z.literal(false) }),
    items: z
      .array(
        z.object({
          centrifugeId: positiveInteger,
          tokenId: z.string(),
          address: z.string().regex(/^0x[\da-fA-F]{40}$/),
          decimals: z.number().int().min(0).max(18),
          totalIssuance: integer,
          tokenPrice: positiveInteger,
          computedAt: positiveInteger,
          blockchain: z.object({ chainId: z.number().int().positive().safe() })
        })
      )
      .nonempty()
  }),
  _meta: z.object({ status: z.record(z.unknown()) })
}) satisfies z.ZodType<ResultOf<typeof NETWORK_SHARE_METRICS_QUERY>>;

const statusSchema = z.object({
  id: z.number().int().positive().safe(),
  block: z.object({ timestamp: z.number().int().positive().safe() })
});

export type NetworkShareMetrics = {
  /** Exact sum of network supply × network price, normalized to USD with 36 decimals. */
  navD36: bigint;
  /** The share class's published price, USD with 18 decimals. */
  sharePriceD18: bigint;
  priceComputedAt: Date;
  /** Oldest network price publication and indexed block used in the NAV. */
  navPriceComputedAt: Date;
  indexedAt: Date;
};

/** Lighthouse's per-network NAV. Existing hub-price readers deliberately remain unchanged. */
export async function fetchNetworkShareMetrics({
  environment,
  shareClassKey,
  fetchOptions,
  now = Date.now()
}: {
  environment: CentrifugeEnvironment;
  shareClassKey: string;
  fetchOptions?: RequestInit;
  now?: number;
}): Promise<NetworkShareMetrics> {
  const identity = getShareClassIdentity({ environment, key: shareClassKey });
  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
    query: NETWORK_SHARE_METRICS_QUERY,
    variables: { tokenId: identity.scId },
    dataSchema,
    fetchOptions
  });
  const fail = (): never => {
    throw new CentrifugeIndexerError({
      kind: 'validation',
      message: `Incomplete or inconsistent network metrics for "${shareClassKey}" on ${environment}.`
    });
  };
  const timestamp = (value: string | number) => {
    const ms = Number(value);
    if (!Number.isSafeInteger(ms) || ms <= 0 || ms > now + 30_000) return fail();
    return ms;
  };
  const { token, tokenInstances: page } = data;
  if (
    token.id !== identity.scId ||
    token.poolId !== identity.poolId ||
    token.decimals !== identity.decimals ||
    page.totalCount !== page.items.length
  )
    fail();
  const chainIds = new Set<number>();
  const centrifugeIds = new Set<string>();
  const statuses = Object.values(data._meta.status).flatMap((value) => {
    const parsed = statusSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
  let supply = 0n;
  let navD36 = 0n;
  const priceTimes: Array<number> = [];
  const indexTimes: Array<number> = [];
  for (const row of page.items) {
    const chainId = row.blockchain.chainId;
    if (
      row.tokenId !== identity.scId ||
      row.decimals !== identity.decimals ||
      chainIds.has(chainId) ||
      centrifugeIds.has(row.centrifugeId)
    )
      fail();
    chainIds.add(chainId);
    centrifugeIds.add(row.centrifugeId);
    const status = statuses.find((entry) => entry.id === chainId);
    if (!status) return fail();
    const indexedAt = timestamp(status.block.timestamp * 1000);
    // A responsive but stalled indexer is a failed refresh, just as in Lighthouse.
    if (indexedAt < now - 300_000) fail();
    indexTimes.push(indexedAt);
    priceTimes.push(timestamp(row.computedAt));
    supply += BigInt(row.totalIssuance);
    navD36 += BigInt(row.totalIssuance) * BigInt(row.tokenPrice) * 10n ** BigInt(18 - row.decimals);
  }
  // Require all catalog deployments, include future indexed networks automatically,
  // and reconcile the full supply so omitted networks cannot understate NAV.
  for (const chain of listLiveChains({ environment, key: shareClassKey })) {
    const row = page.items.find((item) => item.blockchain.chainId === getChainId(chain));
    const expected = listShareClassChainIdentities({ chain, key: shareClassKey })[0];
    if (row?.address.toLowerCase() !== expected.shareTokenAddress.toLowerCase()) fail();
  }
  if (supply !== BigInt(token.totalIssuance)) fail();
  return {
    navD36,
    sharePriceD18: BigInt(token.tokenPrice),
    priceComputedAt: new Date(timestamp(token.tokenPriceComputedAt)),
    navPriceComputedAt: new Date(Math.min(...priceTimes)),
    indexedAt: new Date(Math.min(...indexTimes))
  };
}
