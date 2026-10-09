import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../chains';
import { fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { getShareClassIdentity } from '../share-classes';

/**
 * One wallet's share-token balance changes, one row per Transfer leg that
 * touched the wallet on any spoke chain, newest first on the wire. The indexer keys these
 * by log index, so every leg is kept — the one entity that reconstructs a
 * wallet's balance on any past day exactly. (A leg is skipped upstream when
 * the chain had no token price yet; the next row's balance still carries
 * the true running total, so a history built from `balanceAfter` stays right.)
 */
const CHECKPOINTS_QUERY = graphql(`
  query InvestorPositionCheckpoints($tokenId: String!, $poolId: BigInt!, $account: String!, $after: String) {
    investorPositionCheckpoints(
      where: { tokenId: $tokenId, poolId: $poolId, accountAddress: $account }
      orderBy: "createdAt"
      orderDirection: "desc"
      limit: 1000
      after: $after
    ) {
      items {
        balanceAfter
        createdAt
        createdAtBlock
        createdAtTxHash
        logIndex
        tokenInstance {
          blockchain {
            id
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

const integerString = z.string().regex(/^\d+$/);
const msTimestampString = z.string().regex(/^\d{13,}$/);

const dataSchema = z.object({
  investorPositionCheckpoints: z.object({
    items: z.array(
      z.object({
        balanceAfter: integerString,
        createdAt: msTimestampString,
        createdAtBlock: z.number().int(),
        createdAtTxHash: z.string(),
        logIndex: z.number().int(),
        tokenInstance: z.object({ blockchain: z.object({ id: integerString }).nullable() }).nullable()
      })
    ),
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() })
  })
}) satisfies z.ZodType<ResultOf<typeof CHECKPOINTS_QUERY>>;

export type InvestorPositionCheckpoint = {
  /** EVM chain id of the spoke the balance changed on. */
  chainId: number;
  /** The wallet's share-token balance on that chain after this leg, in share base units. */
  balanceAfter: bigint;
  timestampMs: number;
  block: number;
  logIndex: number;
  txHash: string;
};

/** The indexer's page cap; a wallet past this many pages is pathological, not a loop to follow forever. */
const MAX_PAGES = 50;

/**
 * Every balance checkpoint of one wallet in one share class, oldest first.
 * Fetched newest first, so a walk cut short (page cap, or a cursor that
 * stopped advancing) loses the oldest days, never the recent balance;
 * `complete` is false in that case so a caller never mistakes a truncated
 * history for the whole one. Rows the indexer could not pin to a chain are
 * dropped: they cannot be placed in a per-chain series.
 */
export async function fetchInvestorPositionCheckpoints({
  environment,
  shareClassKey,
  account,
  fetchOptions
}: {
  environment: CentrifugeEnvironment;
  shareClassKey: string;
  account: string;
  fetchOptions?: RequestInit;
}): Promise<{ checkpoints: Array<InvestorPositionCheckpoint>; complete: boolean }> {
  const shareClass = getShareClassIdentity({ environment, key: shareClassKey });
  const checkpoints: Array<InvestorPositionCheckpoint> = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data: z.infer<typeof dataSchema> = await fetchCentrifugeIndexer({
      indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
      query: CHECKPOINTS_QUERY,
      variables: { tokenId: shareClass.scId, poolId: shareClass.poolId, account: account.toLowerCase(), after },
      dataSchema,
      fetchOptions
    });

    for (const item of data.investorPositionCheckpoints.items) {
      const chainId = item.tokenInstance?.blockchain?.id;
      if (chainId === undefined) continue;
      checkpoints.push({
        chainId: Number(chainId),
        balanceAfter: BigInt(item.balanceAfter),
        timestampMs: Number(item.createdAt),
        block: item.createdAtBlock,
        logIndex: item.logIndex,
        txHash: item.createdAtTxHash.toLowerCase()
      });
    }

    const { hasNextPage, endCursor } = data.investorPositionCheckpoints.pageInfo;
    if (!hasNextPage) return { checkpoints: checkpoints.sort(compareCheckpoints), complete: true };
    if (!endCursor || endCursor === after) break;
    after = endCursor;
  }

  return { checkpoints: checkpoints.sort(compareCheckpoints), complete: false };
}

/** Chain order: by time, then block, then the log index within the block. */
export function compareCheckpoints(a: InvestorPositionCheckpoint, b: InvestorPositionCheckpoint): number {
  return a.timestampMs - b.timestampMs || a.block - b.block || a.logIndex - b.logIndex;
}
