import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../chains';
import { fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { getShareClassIdentity } from '../share-classes';

/**
 * The investor-transaction types a sync-deposit/async-redeem Centrifuge
 * vault writes for a wallet, i.e. the whole raw material of a wallet's
 * activity feed. What the indexer does NOT write, verified against its
 * source and every live row: any `*_CANCELLED` row (a cancellation leaves
 * only the `TRANSFER_IN` of the shares coming back), approvals (hub-side,
 * in `redeemOrders`), and a second same-type row for one wallet in one
 * transaction (the primary key is pool, token, account, type, tx hash).
 */
export const INVESTOR_ACTIVITY_TYPES = [
  'SYNC_DEPOSIT',
  'REDEEM_REQUEST_UPDATED',
  'REDEEM_CLAIMABLE',
  'REDEEM_CLAIMED',
  'TRANSFER_IN',
  'TRANSFER_OUT'
] as const;
export type InvestorActivityType = (typeof INVESTOR_ACTIVITY_TYPES)[number];

const ACTIVITY_QUERY = graphql(`
  query InvestorActivity($where: InvestorTransactionFilter!, $limit: Int!, $after: String) {
    investorTransactions(where: $where, orderBy: "createdAt", orderDirection: "desc", limit: $limit, after: $after) {
      items {
        type
        tokenAmount
        currencyAmount
        createdAt
        createdAtBlock
        createdAtTxHash
        blockchain {
          id
        }
        currencyAsset {
          address
          symbol
          decimals
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

const ISSUANCES_QUERY = graphql(`
  query ManualShareIssuances($tokenId: String!, $poolId: BigInt!, $account: String!) {
    tokenIssuances(
      where: { tokenId: $tokenId, poolId: $poolId, account: $account, type: ISSUE, isManual: true }
      limit: 1000
    ) {
      items {
        shares
        createdAtTxHash
        blockchain {
          id
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`);

const integerString = z.string().regex(/^\d+$/);
const msTimestampString = z.string().regex(/^\d{13,}$/);
const pageInfo = z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() });

const activitySchema = z.object({
  investorTransactions: z.object({
    items: z.array(
      z.object({
        type: z.enum(INVESTOR_ACTIVITY_TYPES),
        tokenAmount: integerString.nullable(),
        currencyAmount: integerString.nullable(),
        createdAt: msTimestampString,
        createdAtBlock: z.number().int(),
        createdAtTxHash: z.string(),
        blockchain: z.object({ id: integerString }).nullable(),
        currencyAsset: z
          .object({ address: z.string().nullable(), symbol: z.string().nullable(), decimals: z.number().int() })
          .nullable()
      })
    ),
    pageInfo
  })
}) satisfies z.ZodType<ResultOf<typeof ACTIVITY_QUERY>>;

const issuancesSchema = z.object({
  tokenIssuances: z.object({
    items: z.array(
      z.object({
        shares: integerString,
        createdAtTxHash: z.string(),
        blockchain: z.object({ id: integerString }).nullable()
      })
    ),
    pageInfo: z.object({ hasNextPage: z.boolean() })
  })
}) satisfies z.ZodType<ResultOf<typeof ISSUANCES_QUERY>>;

export type InvestorActivityRow = {
  type: InvestorActivityType;
  /** EVM chain id; null when the indexer could not pin the row to a chain. */
  chainId: number | null;
  txHash: string;
  timestampMs: number;
  block: number;
  /** Share amount in share base units (the increment on a request row, never the pending total). */
  tokenAmount: bigint | null;
  /** Deposit-asset amount in that asset's base units. */
  currencyAmount: bigint | null;
  /** The row's deposit asset as the indexer registered it; null on transfer rows. */
  asset: { address: string; symbol: string | null; decimals: number } | null;
};

type WalletArgs = {
  environment: CentrifugeEnvironment;
  shareClassKey: string;
  account: string;
  fetchOptions?: RequestInit;
};

const CONTEXT_PAGE_LIMIT = 1000;

/**
 * One page of a wallet's raw investor-transaction rows, newest first, with
 * every row of the transactions on the page included: a page boundary must
 * not separate a deposit from its mint leg, or a request from its escrow
 * leg, so the rows of the boundary transactions are fetched whole in a
 * second request. Rows are unique by (type, tx hash) — the indexer's own
 * key for one wallet in one share class.
 */
export async function fetchInvestorActivityPage({
  environment,
  shareClassKey,
  account,
  fetchOptions,
  after = null,
  limit = 20
}: WalletArgs & { after?: string | null; limit?: number }): Promise<{
  rows: Array<InvestorActivityRow>;
  nextCursor: string | null;
}> {
  const shareClass = getShareClassIdentity({ environment, key: shareClassKey });
  const where = {
    tokenId: shareClass.scId,
    poolId: shareClass.poolId,
    account: account.toLowerCase(),
    type_in: [...INVESTOR_ACTIVITY_TYPES]
  };
  const indexerUrl = CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl;

  const page = await fetchCentrifugeIndexer({
    indexerUrl,
    query: ACTIVITY_QUERY,
    variables: { where, limit: Math.max(1, Math.min(1000, limit)), after },
    dataSchema: activitySchema,
    fetchOptions
  });
  const { items, pageInfo: info } = page.investorTransactions;
  if (info.hasNextPage && (!info.endCursor || info.endCursor === after))
    throw new Error('Activity pagination did not advance.');

  const rows = new Map(items.map((item) => [`${item.type}:${item.createdAtTxHash.toLowerCase()}`, item]));
  if (items.length > 0) {
    const context = await fetchCentrifugeIndexer({
      indexerUrl,
      query: ACTIVITY_QUERY,
      variables: {
        where: { ...where, createdAtTxHash_in: [...new Set(items.map((item) => item.createdAtTxHash))] },
        limit: CONTEXT_PAGE_LIMIT,
        after: null
      },
      dataSchema: activitySchema,
      fetchOptions
    });
    for (const item of context.investorTransactions.items)
      rows.set(`${item.type}:${item.createdAtTxHash.toLowerCase()}`, item);
  }

  return {
    rows: [...rows.values()].map((item) => ({
      type: item.type,
      chainId: item.blockchain ? Number(item.blockchain.id) : null,
      txHash: item.createdAtTxHash.toLowerCase(),
      timestampMs: Number(item.createdAt),
      block: item.createdAtBlock,
      tokenAmount: item.tokenAmount === null ? null : BigInt(item.tokenAmount),
      currencyAmount: item.currencyAmount === null ? null : BigInt(item.currencyAmount),
      asset:
        item.currencyAsset?.address == null
          ? null
          : {
              address: item.currencyAsset.address.toLowerCase(),
              symbol: item.currencyAsset.symbol,
              decimals: item.currencyAsset.decimals
            }
    })),
    nextCursor: info.hasNextPage ? info.endCursor : null
  };
}

export type ManualShareIssuance = { chainId: number | null; txHash: string; shares: bigint };

/**
 * Shares the manager minted straight into the wallet (BalanceSheet.Issue
 * with `isManual`), which is how positions migrated from the earlier vault
 * structure arrived. The feed needs them to tell "issued to you" from a
 * transfer received, because both land as a bare `TRANSFER_IN`.
 */
export async function fetchManualShareIssuances({
  environment,
  shareClassKey,
  account,
  fetchOptions
}: WalletArgs): Promise<Array<ManualShareIssuance>> {
  const shareClass = getShareClassIdentity({ environment, key: shareClassKey });
  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
    query: ISSUANCES_QUERY,
    variables: { tokenId: shareClass.scId, poolId: shareClass.poolId, account: account.toLowerCase() },
    dataSchema: issuancesSchema,
    fetchOptions
  });

  return data.tokenIssuances.items.map((item) => ({
    chainId: item.blockchain ? Number(item.blockchain.id) : null,
    txHash: item.createdAtTxHash.toLowerCase(),
    shares: BigInt(item.shares)
  }));
}
