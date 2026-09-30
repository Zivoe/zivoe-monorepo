import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../chains';
import { fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { getShareClassIdentity } from '../share-classes';

const CHECKPOINTS = graphql(`
  query WalletCheckpoints($tokenId: String!, $poolId: BigInt!, $account: String!, $after: String) {
    investorPositionCheckpoints(
      where: { tokenId: $tokenId, poolId: $poolId, accountAddress: $account }
      orderBy: "createdAt"
      orderDirection: "asc"
      limit: 1000
      after: $after
    ) {
      items {
        centrifugeId
        balanceBefore
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

const ACTIVITY = graphql(`
  query WalletActivity($where: InvestorTransactionFilter!, $after: String, $limit: Int!) {
    investorTransactions(where: $where, orderBy: "createdAt", orderDirection: "desc", limit: $limit, after: $after) {
      items {
        type
        centrifugeId
        tokenAmount
        currencyAmount
        createdAt
        createdAtBlock
        createdAtTxHash
        fromAccount
        toAccount
        fromCentrifugeId
        toCentrifugeId
        transferMessageId
        transferLeg
        blockchain {
          id
        }
        currencyAsset {
          address
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

const uint = z.string().regex(/^\d+$/);
const timestamp = z
  .string()
  .regex(/^\d{13,}$/)
  .refine((value) => Number.isSafeInteger(Number(value)));
const pageInfo = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });
const checkpointSchema = z.object({
  centrifugeId: z.string(),
  balanceBefore: uint,
  balanceAfter: uint,
  createdAt: timestamp,
  createdAtBlock: z.number().int(),
  createdAtTxHash: z.string(),
  logIndex: z.number().int(),
  tokenInstance: z.object({ blockchain: z.object({ id: uint }).nullable() }).nullable()
});
const checkpointsSchema = z.object({
  investorPositionCheckpoints: z.object({ items: z.array(checkpointSchema), pageInfo })
}) satisfies z.ZodType<ResultOf<typeof CHECKPOINTS>>;

// Deliberately separate from the Transaction Monitor's narrower event scope.
const activityTypes = [
  'DEPOSIT_REQUEST_UPDATED',
  'REDEEM_REQUEST_UPDATED',
  'DEPOSIT_REQUEST_CANCELLED',
  'REDEEM_REQUEST_CANCELLED',
  'DEPOSIT_REQUEST_EXECUTED',
  'REDEEM_REQUEST_EXECUTED',
  'DEPOSIT_CLAIMABLE',
  'REDEEM_CLAIMABLE',
  'DEPOSIT_CLAIMED',
  'REDEEM_CLAIMED',
  'SYNC_DEPOSIT',
  'SYNC_REDEEM',
  'TRANSFER_IN',
  'TRANSFER_OUT'
] as const;
const activitySchema = z.object({
  type: z.enum(activityTypes),
  centrifugeId: z.string(),
  tokenAmount: uint.nullable(),
  currencyAmount: uint.nullable(),
  createdAt: timestamp,
  createdAtBlock: z.number().int(),
  createdAtTxHash: z.string(),
  fromAccount: z.string().nullable(),
  toAccount: z.string().nullable(),
  fromCentrifugeId: z.string().nullable(),
  toCentrifugeId: z.string().nullable(),
  transferMessageId: z.string().nullable(),
  transferLeg: z.enum(['IN', 'OUT']).nullable(),
  blockchain: z.object({ id: uint }).nullable(),
  currencyAsset: z.object({ address: z.string().nullable() }).nullable()
});
const activitiesSchema = z.object({
  investorTransactions: z.object({ items: z.array(activitySchema), pageInfo })
}) satisfies z.ZodType<ResultOf<typeof ACTIVITY>>;

type WalletArgs = {
  environment: CentrifugeEnvironment;
  shareClassKey: string;
  account: string;
  fetchOptions?: RequestInit;
};
export type WalletCheckpoint = {
  chainId: number | null;
  centrifugeId: string;
  balanceBefore: bigint;
  balanceAfter: bigint;
  timestampMs: number;
  block: number;
  logIndex: number;
  txHash: string;
};
export type WalletActivity = {
  type: (typeof activityTypes)[number];
  chainId: number | null;
  centrifugeId: string;
  tokenAmount: bigint | null;
  currencyAmount: bigint | null;
  assetAddress: string | null;
  timestampMs: number;
  block: number;
  txHash: string;
  fromAccount: string | null;
  toAccount: string | null;
  fromCentrifugeId?: string | null;
  toCentrifugeId?: string | null;
  transferMessageId?: string | null;
  transferLeg?: 'IN' | 'OUT' | null;
};

/** Cursor walk is bounded; an interrupted or missing cursor is never reported as complete. */
export async function fetchWalletCheckpoints({
  environment,
  shareClassKey,
  account,
  fetchOptions
}: WalletArgs): Promise<{ checkpoints: Array<WalletCheckpoint>; complete: boolean }> {
  const share = getShareClassIdentity({ environment, key: shareClassKey });
  const checkpoints = new Map<string, WalletCheckpoint>();
  let after: string | null = null;
  const cursors = new Set<string>();
  for (let page = 0; page < 100; page++) {
    const data: z.infer<typeof checkpointsSchema> = await fetchCentrifugeIndexer({
      indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
      query: CHECKPOINTS,
      variables: { tokenId: share.scId, poolId: share.poolId, account: account.toLowerCase(), after },
      dataSchema: checkpointsSchema,
      fetchOptions
    });
    for (const item of data.investorPositionCheckpoints.items) {
      const row = {
        chainId: item.tokenInstance?.blockchain ? Number(item.tokenInstance.blockchain.id) : null,
        centrifugeId: item.centrifugeId,
        balanceBefore: BigInt(item.balanceBefore),
        balanceAfter: BigInt(item.balanceAfter),
        timestampMs: Number(item.createdAt),
        block: item.createdAtBlock,
        logIndex: item.logIndex,
        txHash: item.createdAtTxHash.toLowerCase()
      };
      checkpoints.set(`${row.centrifugeId}:${row.txHash}:${row.logIndex}`, row);
    }
    const info = data.investorPositionCheckpoints.pageInfo;
    if (!info.hasNextPage) return { checkpoints: [...checkpoints.values()].sort(compareCheckpoints), complete: true };
    if (!info.endCursor || cursors.has(info.endCursor)) break;
    cursors.add(info.endCursor);
    after = info.endCursor;
  }
  return { checkpoints: [...checkpoints.values()].sort(compareCheckpoints), complete: false };
}

export function compareCheckpoints(a: WalletCheckpoint, b: WalletCheckpoint): number {
  return a.timestampMs - b.timestampMs || a.block - b.block || a.logIndex - b.logIndex;
}

export async function fetchWalletActivityPage({
  environment,
  shareClassKey,
  account,
  fetchOptions,
  after = null,
  transfersOnly = false,
  includeTransactionContext = false,
  limit = 20
}: WalletArgs & {
  after?: string | null;
  transfersOnly?: boolean;
  includeTransactionContext?: boolean;
  limit?: number;
}): Promise<{
  entries: Array<WalletActivity>;
  nextCursor: string | null;
}> {
  const share = getShareClassIdentity({ environment, key: shareClassKey });
  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
    query: ACTIVITY,
    variables: {
      // Ponder rejects null `_in` filters at runtime. Omit the optional hash
      // filter entirely here; only the context request below supplies it.
      where: {
        tokenId: share.scId,
        poolId: share.poolId,
        account: account.toLowerCase(),
        type_in: transfersOnly ? ['TRANSFER_IN', 'TRANSFER_OUT'] : [...activityTypes]
      },
      after,
      limit: Math.max(1, Math.min(1000, limit))
    },
    dataSchema: activitiesSchema,
    fetchOptions
  });
  const { items, pageInfo: info } = data.investorTransactions;
  if (info.hasNextPage && (!info.endCursor || info.endCursor === after))
    throw new Error('Activity pagination did not advance. Please retry.');
  // Fetch the other events for these transactions before rendering: a page
  // boundary (or the Transfers filter) must not separate a mint from its deposit.
  const transactionItems = [...items];
  if (includeTransactionContext && items.length > 0) {
    const txHashes = [...new Set(items.map((item) => item.createdAtTxHash))];
    let contextCursor: string | null = null;
    const cursors = new Set<string>();
    for (let page = 0; page < 100; page++) {
      const context: z.infer<typeof activitiesSchema> = await fetchCentrifugeIndexer({
        indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
        query: ACTIVITY,
        variables: {
          where: {
            tokenId: share.scId,
            poolId: share.poolId,
            account: account.toLowerCase(),
            type_in: [...activityTypes],
            createdAtTxHash_in: txHashes
          },
          after: contextCursor,
          limit: 1000
        },
        dataSchema: activitiesSchema,
        fetchOptions
      });
      transactionItems.push(...context.investorTransactions.items);
      const contextInfo = context.investorTransactions.pageInfo;
      if (!contextInfo.hasNextPage) break;
      if (!contextInfo.endCursor || cursors.has(contextInfo.endCursor) || page === 99)
        throw new Error('Transaction activity is incomplete. Please retry.');
      cursors.add(contextInfo.endCursor);
      contextCursor = contextInfo.endCursor;
    }
  }
  const uniqueItems = [
    ...new Map(
      transactionItems.map((item) => [
        `${item.centrifugeId}:${item.createdAtTxHash.toLowerCase()}:${item.type}:${item.currencyAsset?.address?.toLowerCase() ?? ''}`,
        item
      ])
    ).values()
  ];
  return {
    entries: uniqueItems.map((item) => ({
      type: item.type,
      chainId: item.blockchain ? Number(item.blockchain.id) : null,
      centrifugeId: item.centrifugeId,
      tokenAmount: item.tokenAmount === null ? null : BigInt(item.tokenAmount),
      currencyAmount: item.currencyAmount === null ? null : BigInt(item.currencyAmount),
      assetAddress: item.currencyAsset?.address?.toLowerCase() ?? null,
      timestampMs: Number(item.createdAt),
      block: item.createdAtBlock,
      txHash: item.createdAtTxHash.toLowerCase(),
      fromAccount: item.fromAccount,
      toAccount: item.toAccount,
      fromCentrifugeId: item.fromCentrifugeId,
      toCentrifugeId: item.toCentrifugeId,
      transferMessageId: item.transferMessageId,
      transferLeg: item.transferLeg
    })),
    nextCursor: info.hasNextPage ? info.endCursor : null
  };
}
