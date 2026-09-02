import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../chains';
import { fetchCentrifugeIndexer } from '../fetch';
import { graphql } from '../graphql';
import { getShareClassIdentity } from '../share-classes';

/**
 * The investor-transaction types a sync-deposit/async-redeem Centrifuge
 * Vault emits along its lifecycle — the alerting surface: money moved in
 * (SYNC_DEPOSIT), redemption asked for (REDEEM_REQUEST_UPDATED), the
 * manager's approval executed on the spoke (REDEEM_CLAIMABLE, one row per
 * partial fill), and the investor collecting the assets (REDEEM_CLAIMED).
 * Excluded on purpose: TRANSFER_IN/TRANSFER_OUT — live on both pools (they
 * are in fact the most frequent types: share movements and cross-chain
 * bridging) but not investor cash flow, so they stay out of the channel.
 * The remaining stages are unindexed upstream (cancels) or have no event by
 * design (approvals).
 */
export const INVESTOR_TRANSACTION_EVENT_TYPES = [
  'SYNC_DEPOSIT',
  'REDEEM_REQUEST_UPDATED',
  'REDEEM_CLAIMABLE',
  'REDEEM_CLAIMED'
] as const;
export type InvestorTransactionEventType = (typeof INVESTOR_TRANSACTION_EVENT_TYPES)[number];

// `type_in` is a variable so INVESTOR_TRANSACTION_EVENT_TYPES is the single
// source of the alert surface — widening the const widens the wire filter,
// the zod boundary, and (via the mirror test) the ledger enum together.
const INVESTOR_TRANSACTION_EVENTS_QUERY = graphql(`
  query InvestorTransactionEvents(
    $tokenId: String!
    $poolId: BigInt!
    $types: [InvestorTransactionType!]!
    $limit: Int!
    $after: String
  ) {
    investorTransactions(
      where: { tokenId: $tokenId, poolId: $poolId, type_in: $types }
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

const integerString = z.string().regex(/^\d+$/);
// 13+ digits pins the epoch-milliseconds unit: a silent upstream flip to
// seconds would otherwise put every row behind the cursor forever — the one
// drift this boundary must fail loudly on.
const msTimestampString = z.string().regex(/^\d{13,}$/);

// The walk's ordering backbone, validated separately from the row content:
// `createdAt` drives the window cut AND bounds the caller's cursor advance,
// so a row it cannot order is a page-level failure, never a skippable one.
const orderingSchema = z.object({ createdAt: msTimestampString });

/**
 * One row's content, validated row-by-row so a single malformed row is
 * skipped and counted instead of halting alerting for every vault and chain
 * (the sibling status query sets the precedent). Only `createdAt` above stays
 * page-fatal.
 */
const itemSchema = z
  .object({
    // Stricter than the schema's enum on purpose (house precedent): the
    // server-side type_in filter guarantees exactly these types, so
    // anything else is drift and should be skipped and alarmed, not flow onward.
    type: z.enum(INVESTOR_TRANSACTION_EVENT_TYPES),
    centrifugeId: z.string(),
    account: z.string(),
    // Unsigned: every alertable type moves a non-negative amount, so a
    // negative row is upstream drift. Refusing it here, once, keeps the
    // Telegram line, the Notified Ledger and the Receipt Mailer in agreement
    // — the mailer's own unsigned contract would otherwise DLQ a receipt the
    // channel had already alerted and the ledger had already recorded.
    tokenAmount: integerString.nullable(),
    currencyAmount: integerString.nullable(),
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
    (item) => item.type !== 'REDEEM_REQUEST_UPDATED' || (item.tokenAmount !== null && BigInt(item.tokenAmount) > 0n),
    { message: 'Redeem request tokenAmount must be positive', path: ['tokenAmount'] }
  );

// Unlike the sibling queries this cannot carry `satisfies z.ZodType<ResultOf<…>>`:
// rows are deliberately taken as unknown here and validated one-by-one below,
// so one malformed row never rejects the page it arrived on.
const dataSchema = z.object({
  investorTransactions: z.object({
    items: z.array(z.unknown()),
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() })
  })
});

export type InvestorTransactionEvent = {
  type: InvestorTransactionEventType;
  /** Centrifuge's spoke-chain id — distinct per chain, so multi-chain rows never merge silently. */
  centrifugeId: string;
  /** EVM chain id of the spoke the event happened on; null when the relation is unavailable. */
  chainId: number | null;
  /** Lowercase investor address. */
  account: string;
  /** Shares moved by THIS call (a positive increment for redeem requests), share-token base units; never negative. */
  tokenAmount: bigint | null;
  /** Assets moved, asset base units (USDC 6dp); 0 on redeem requests; never negative. */
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

/**
 * Identity of a skipped row, best-effort plucked from the raw payload so the
 * caller's alarm names the transaction that will never alert — without it an
 * operator would have to hand-query the whole window to find the dropped row.
 */
export type MalformedInvestorTransaction = {
  txHash: string | null;
  type: string | null;
  account: string | null;
  /** The first zod issue — enough to say why the row was refused. */
  issue: string;
};

/** The indexer server rejects pages larger than 1000 rows. */
const MAX_PAGE_LIMIT = 1000;
/** Runtime bound for one poll — five full pages is months of alertable activity. */
const MAX_PAGES = 5;

/**
 * Alertable investor transactions (deposits + the redemption lifecycle) newer
 * than `sinceMs`, oldest first, across every spoke chain of the share class.
 *
 * The indexer's `createdAt` filter is a String with no numeric comparators, so
 * the time cut happens client-side: pages are walked newest-first and the walk
 * stops as soon as a page crosses `sinceMs` (or `MAX_PAGES` is hit — then
 * `truncated` flags that older alertable rows exist beyond the walk, so the
 * caller can alarm instead of silently treating the window as complete).
 *
 * Rows whose content fails validation are skipped and returned as `malformed`
 * (the caller alarms on them) rather than failing the fetch — except a row
 * whose `createdAt` cannot be ordered, which fails the whole call: without the
 * ordering key the window cut and the cursor advance are both meaningless.
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
}): Promise<{
  events: Array<InvestorTransactionEvent>;
  truncated: boolean;
  malformed: Array<MalformedInvestorTransaction>;
}> {
  const shareClass = getShareClassIdentity({ environment, key: shareClassKey });

  const events: Array<InvestorTransactionEvent> = [];
  const malformed: Array<MalformedInvestorTransaction> = [];
  let after: string | null = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    // Annotated to break a circular inference: `after` feeds the variables the
    // generics unify over, and is reassigned from the result below.
    const data: z.infer<typeof dataSchema> = await fetchCentrifugeIndexer({
      indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
      query: INVESTOR_TRANSACTION_EVENTS_QUERY,
      variables: {
        tokenId: shareClass.scId,
        poolId: shareClass.poolId,
        types: [...INVESTOR_TRANSACTION_EVENT_TYPES],
        limit: MAX_PAGE_LIMIT,
        after
      },
      dataSchema,
      fetchOptions
    });

    const items = data.investorTransactions.items;
    let crossedWindow = false;

    for (const raw of items) {
      const ordering = orderingSchema.safeParse(raw);
      if (!ordering.success)
        throw new Error(`Centrifuge indexer returned an unorderable investor transaction: ${ordering.error.message}`);

      const createdAtMs = Number(ordering.data.createdAt);
      if (createdAtMs <= sinceMs) {
        crossedWindow = true;
        break;
      }

      const parsed = itemSchema.safeParse(raw);
      if (!parsed.success) {
        const rec = raw as Record<string, unknown>;
        malformed.push({
          txHash: typeof rec.createdAtTxHash === 'string' ? rec.createdAtTxHash : null,
          type: typeof rec.type === 'string' ? rec.type : null,
          account: typeof rec.account === 'string' ? rec.account : null,
          issue: parsed.error.issues[0]?.message ?? 'unknown'
        });
        continue;
      }
      const item = parsed.data;

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

  return { events: events.reverse(), truncated, malformed };
}
