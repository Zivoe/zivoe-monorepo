import { bigint, boolean, index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';

/**
 * The indexer-native investor-transaction types the monitor captures — kept
 * in lockstep with INVESTOR_TRANSACTION_EVENT_TYPES (the zod boundary) in
 * @zivoe/centrifuge-indexer. Widening capture is one commit touching both
 * plus an ALTER TYPE migration, which makes the migration the reviewable
 * artifact of "we now alert on X".
 */
export const investorTransactionTypeValues = [
  'SYNC_DEPOSIT',
  'REDEEM_REQUEST_UPDATED',
  'REDEEM_CLAIMABLE',
  'REDEEM_CLAIMED'
] as const;
export const investorTransactionTypeEnum = pgEnum('investor_transaction_type', investorTransactionTypeValues);
export type InvestorTransactionType = (typeof investorTransactionTypeValues)[number];

/**
 * Per-(event, user) email-delivery dedupe, dormant until per-user emails
 * return. The 0008 migration cleared the retired monitor's rows (their ids
 * can never match the new eventId format) and relaxed event_type to text:
 * a dedupe log needs no enum integrity, and the revived path will write the
 * indexer-native type names.
 */
export const transactionEmailSent = pgTable(
  'transaction_email_sent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: text('event_id').notNull(),
    txHash: text('tx_hash').notNull(),
    logIndex: text('log_index').notNull(),
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    walletAddress: text('wallet_address').notNull(),
    eventType: text('event_type').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow()
  },
  (table) => [
    unique('transaction_email_sent_event_user_unique').on(table.eventId, table.userId),
    index('transaction_email_sent_event_idx').on(table.eventId)
  ]
);

/**
 * One row per monitor: the timestamp watermark a polling pass resumes from.
 * Replaces the retired block-number cursor — indexer rows are ordered by
 * `createdAt` (ms) and block heights are not comparable across spoke chains.
 * Passes re-read from a small overlap behind the watermark and rely on
 * transactionNotified for exactly-once delivery, so the watermark only needs
 * monotonicity (enforced at the write site), not precision.
 */
export const monitorCursor = pgTable('monitor_cursor', {
  monitor: text('monitor').primaryKey(),
  lastEventAt: bigint('last_event_at', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Event-level "already alerted" ledger — one row per notified on-chain event,
 * keyed by the event's canonical id (scId : centrifugeId : txHash : type :
 * account; addresses and hashes lowercase) so events never collide across
 * share classes or spoke chains. Channel-agnostic on purpose: the same eventId slots into
 * transactionEmailSent.eventId if per-user emails return, whose per-(event,
 * user) grain stays the email-side dedupe.
 */
export const transactionNotified = pgTable('transaction_notified', {
  eventId: text('event_id').primaryKey(),
  eventType: investorTransactionTypeEnum('event_type').notNull(),
  txHash: text('tx_hash').notNull(),
  account: text('account').notNull(),
  centrifugeId: text('centrifuge_id').notNull(),
  eventAt: bigint('event_at', { mode: 'number' }).notNull(),
  notifiedAt: timestamp('notified_at', { withTimezone: true }).notNull().defaultNow()
});

export const userEmailPreferences = pgTable('user_email_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  productTipsEnabled: boolean('product_tips_enabled').notNull().default(true),
  transactionReceiptsEnabled: boolean('transaction_receipts_enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
