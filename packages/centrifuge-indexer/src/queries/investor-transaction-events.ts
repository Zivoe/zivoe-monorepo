import { z } from 'zod';

import { getShareClassIdentity } from '../catalog';
import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../config';
import { fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';

/**
 * The two investor-transaction types a sync-deposit/async-redeem Centrifuge
 * Vault emits for "money moved in / redemption asked for" — the alerting
 * surface. The other stages either cannot occur on this Centrifuge Vault
 * shape, are unindexed upstream (cancels), or have no event by design
 * (approvals).
 */
export const INVESTOR_TRANSACTION_EVENT_TYPES = ['SYNC_DEPOSIT', 'REDEEM_REQUEST_UPDATED'] as const;
export type InvestorTransactionEventType = (typeof INVESTOR_TRANSACTION_EVENT_TYPES)[number];

const INVESTOR_TRANSACTION_EVENTS_QUERY = graphql(`
  query InvestorTransactionEvents($tokenId: String!, $poolId: BigInt!, $limit: Int!, $after: String) {
    investorTransactions(
      where: { tokenId: $tokenId, poolId: $poolId, type_in: [SYNC_DEPOSIT, REDEEM_REQUEST_UPDATED] }
      orderBy: "createdAt"
      orderDirection: "desc"
      limit: $limit
      after: $after
    ) {
      items {
        type
        centrifugeId
        account
        tokenAmount
        currencyAmount
        tokenPrice
        createdAt
        createdAtTxHash
        blockchain {
          id
          network
          explorer
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

const signedIntegerString = z.string().regex(/^-?\d+$/);
const integerString = z.string().regex(/^\d+$/);
// 13+ digits pins the epoch-milliseconds unit: a silent upstream flip to
// seconds would otherwise put every row behind the cursor forever — the one
// drift this boundary must fail loudly on.
const msTimestampString = z.string().regex(/^\d{13,}$/);

const dataSchema = z.object({
  investorTransactions: z.object({
    items: z.array(
      z
        .object({
          // Stricter than the schema's enum on purpose (house precedent): the
          // server-side type_in filter guarantees these two, so anything else
          // is drift and should fail loudly here, not flow onward.
          type: z.enum(INVESTOR_TRANSACTION_EVENT_TYPES),
          centrifugeId: z.string(),
          account: z.string(),
          tokenAmount: signedIntegerString.nullable(),
          currencyAmount: signedIntegerString.nullable(),
          tokenPrice: integerString.nullable(),
          createdAt: msTimestampString,
          createdAtTxHash: z.string(),
          // `id` is the EVM chain id as a decimal string — the key the app's
          // own chain registry is indexed by.
          blockchain: z.object({ id: integerString, network: z.string(), explorer: z.string().nullable() }).nullable()
        })
        // API-v3 copies the non-zero uint256 `shares` from RedeemRequest into
        // tokenAmount. A missing or non-positive value is upstream drift, not
        // a cancellation or a signed request delta.
        .refine(
          (item) =>
            item.type !== 'REDEEM_REQUEST_UPDATED' ||
            (item.tokenAmount !== null && BigInt(item.tokenAmount) > 0n),
          { message: 'Redeem request tokenAmount must be positive', path: ['tokenAmount'] }
        )
    ),
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() })
  })
}) satisfies z.ZodType<ResultOf<typeof INVESTOR_TRANSACTION_EVENTS_QUERY>>;

export type InvestorTransactionEvent = {
  type: InvestorTransactionEventType;
  /** Centrifuge's spoke-chain id — distinct per chain, so multi-chain rows never merge silently. */
  centrifugeId: string;
  /** EVM chain id of the spoke the event happened on; null when the relation is unavailable. */
  chainId: number | null;
  /** Lowercase investor address. */
  account: string;
  /** Shares moved by THIS call (a positive increment for redeem requests), share-token base units. */
  tokenAmount: bigint | null;
  /** Assets moved, asset base units (USDC 6dp); 0 on redeem requests. */
  currencyAmount: bigint | null;
  /** Execution Share Price, D18; 0 when the row carries no price (redeem requests). */
  tokenPrice: bigint | null;
  /** Event time in epoch milliseconds (the indexer serializes `createdAt` as a ms string). */
  createdAtMs: number;
  /** Lowercase transaction hash. */
  txHash: string;
  /** Indexer's chain name (e.g. "ethereum"); null when the relation is unavailable. */
  chainName: string | null;
  /** Block-explorer base URL for the event's chain; null when the indexer has none. */
  explorerUrl: string | null;
};

/** The indexer server rejects pages larger than 1000 rows. */
const MAX_PAGE_LIMIT = 1000;
/** Runtime bound for one poll — five full pages is months of alertable activity. */
const MAX_PAGES = 5;

/**
 * Alertable investor transactions (deposits + redeem requests) newer than
 * `sinceMs`, oldest first, across every spoke chain of the share class.
 *
 * The indexer's `createdAt` filter is a String with no numeric comparators, so
 * the time cut happens client-side: pages are walked newest-first and the walk
 * stops as soon as a page crosses `sinceMs` (or `MAX_PAGES` is hit — then
 * `truncated` flags that older alertable rows exist beyond the walk, so the
 * caller can alarm instead of silently treating the window as complete).
 */
export async function fetchInvestorTransactionEventsSince({
  environment,
  shareClassKey,
  sinceMs,
  fetchOptions
}: {
  environment: CentrifugeEnvironment;
  shareClassKey: string;
  sinceMs: number;
  fetchOptions?: RequestInit;
}): Promise<{ events: Array<InvestorTransactionEvent>; truncated: boolean }> {
  const shareClass = getShareClassIdentity({ environment, key: shareClassKey });

  const events: Array<InvestorTransactionEvent> = [];
  let after: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    // Annotated to break a circular inference: `after` feeds the variables the
    // generics unify over, and is reassigned from the result below.
    const data: z.infer<typeof dataSchema> = await fetchCentrifugeIndexer({
      indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
      query: INVESTOR_TRANSACTION_EVENTS_QUERY,
      variables: { tokenId: shareClass.scId, poolId: shareClass.poolId, limit: MAX_PAGE_LIMIT, after },
      dataSchema,
      fetchOptions
    });

    const items = data.investorTransactions.items;
    let crossedWindow = false;

    for (const item of items) {
      const createdAtMs = Number(item.createdAt);
      if (createdAtMs <= sinceMs) {
        crossedWindow = true;
        break;
      }

      events.push({
        type: item.type,
        centrifugeId: item.centrifugeId,
        chainId: item.blockchain ? Number(item.blockchain.id) : null,
        // Normalized once here so downstream identity keys never re-normalize.
        account: item.account.toLowerCase(),
        tokenAmount: item.tokenAmount === null ? null : BigInt(item.tokenAmount),
        currencyAmount: item.currencyAmount === null ? null : BigInt(item.currencyAmount),
        tokenPrice: item.tokenPrice === null ? null : BigInt(item.tokenPrice),
        createdAtMs,
        txHash: item.createdAtTxHash.toLowerCase(),
        chainName: item.blockchain?.network ?? null,
        explorerUrl: item.blockchain?.explorer ?? null
      });
    }

    const hasNextPage = data.investorTransactions.pageInfo.hasNextPage;
    after = data.investorTransactions.pageInfo.endCursor;

    if (crossedWindow || !hasNextPage) break;
    // Older alertable rows exist beyond this page; without a cursor to reach
    // them, or past the page budget, the walk is incomplete and must say so.
    if (after === null || page === MAX_PAGES - 1) {
      truncated = true;
      break;
    }
  }

  return { events: events.reverse(), truncated };
}
