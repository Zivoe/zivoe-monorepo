import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

import { WALLET_LINK_LINKED_ADDRESS_INDEX, walletLinkOpsRequestValues, walletLinkStatusValues } from '../wallet-link';
import { user } from './auth';

export * from '../wallet-link';

export const walletConnection = pgTable(
  'wallet_connection',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
    walletType: text('wallet_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('wallet_connection_user_id_idx').on(table.userId),
    index('wallet_connection_address_idx').on(table.address),
    unique('unique_user_address').on(table.userId, table.address)
  ]
);

export const walletHoldings = pgTable('wallet_holdings', {
  address: text('address').primaryKey(),
  totalValueUsd: numeric('total_value_usd', { mode: 'number' }).notNull(),
  tokenBalanceUsd: numeric('token_balance_usd', { mode: 'number' }).notNull(),
  defiBalanceUsd: numeric('defi_balance_usd', { mode: 'number' }).notNull(),
  holdingsUpdatedAt: timestamp('holdings_updated_at', { withTimezone: true })
});

export const walletLinkStatusEnum = pgEnum('wallet_link_status', walletLinkStatusValues);
export const walletLinkOpsRequestEnum = pgEnum('wallet_link_ops_request', walletLinkOpsRequestValues);

/**
 * A Wallet link — the Ownership proof that makes one account the owner of one
 * address, for good — and what was asked of ops since: the EIP-712 payload
 * handed to the wallet (kept verbatim for audit), the signature that proved
 * control of the address, and the whitelist timeline ops and the reconcile
 * fill in. Whether the address is whitelisted is the chain's to say. The
 * address is stored lowercase. One `linked` row per address across all
 * accounts; one `pending` row per (user, address) so a re-issue upserts.
 * A trigger (migration 0020) keeps a linked row from being deleted, moved out
 * of `linked`, or rewritten to another user, address or proof. Every
 * `wallet_link` row's (user, address) also exists in `wallet_connection`,
 * guaranteed by the write that flips a row to `linked`, not by a constraint.
 */
export const walletLink = pgTable(
  'wallet_link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
    /** Dynamic's `primaryWallet.key`, the same source as `wallet_connection.wallet_type`. */
    walletType: text('wallet_type'),
    /** The wallet's display name as Dynamic gave it at link time (`MetaMask`); what the operator message shows. */
    walletName: text('wallet_name'),
    /** The chain the message was signed on; the one used for EIP-1271 verification. */
    chainId: integer('chain_id').notNull(),
    status: walletLinkStatusEnum('status').notNull(),
    /** Random 32 bytes, hex; fixed for the challenge's lifetime. */
    nonce: text('nonce').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** The exact EIP-712 payload handed to the wallet. */
    typedData: jsonb('typed_data').notNull(),
    signature: text('signature'),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    /** When the latest Whitelist request was queued for ops: the link, or an approval again since. */
    whitelistRequestedAt: timestamp('whitelist_requested_at', { withTimezone: true }),
    /**
     * When the sweep first saw the address admitted (a member, not frozen)
     * on every active chain since the latest Whitelist request — bookkeeping,
     * not the whitelist: the once-marker for the "you're whitelisted" email.
     * Cleared by a new Whitelist request. Whether the address is whitelisted
     * now is always read from the chain.
     */
    whitelistObservedAt: timestamp('whitelist_observed_at', { withTimezone: true }),
    /** What ops was last asked for this Linked address; null on a challenge. */
    opsRequest: walletLinkOpsRequestEnum('ops_request'),
    /**
     * Bumped by every change of `ops_request`, and carried by the job that
     * announces it: delivery sends a job whose version the row holds, retries
     * one the row has not reached, and skips one it has moved past.
     */
    opsRequestVersion: integer('ops_request_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('wallet_link_user_id_idx').on(table.userId),
    // One owner per address, across every account.
    uniqueIndex(WALLET_LINK_LINKED_ADDRESS_INDEX)
      .on(table.address)
      .where(sql`${table.status} = 'linked'`),
    // A re-issued challenge replaces the pending one instead of piling up.
    uniqueIndex('wallet_link_pending_user_address_uidx')
      .on(table.userId, table.address)
      .where(sql`${table.status} = 'pending'`),
    check('wallet_link_address_lowercase_check', sql`${table.address} = lower(${table.address})`),
    // Only a challenge is unsigned: a linked row is an Ownership proof, signature and time included.
    check(
      'wallet_link_linked_has_signature',
      sql`${table.status} = 'pending' OR (${table.signature} IS NOT NULL AND ${table.signedAt} IS NOT NULL)`
    ),
    // A Linked address always says what ops was asked.
    check(
      'wallet_link_linked_has_ops_request',
      sql`${table.status} <> 'linked' OR (${table.opsRequest} IS NOT NULL AND ${table.opsRequestVersion} > 0)`
    )
  ]
);
