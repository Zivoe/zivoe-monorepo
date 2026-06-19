import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';

export const transactionEventTypeValues = ['deposit', 'redemption'] as const;
export const transactionEventTypeEnum = pgEnum('transaction_event_type', transactionEventTypeValues);
export type TransactionEventType = (typeof transactionEventTypeValues)[number];

export const transactionEmailSent = pgTable(
  'transaction_email_sent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: text('event_id').notNull(),
    txHash: text('tx_hash').notNull(),
    logIndex: text('log_index').notNull(),
    userId: uuid('user_id').references(() => user.id, { onDelete: 'set null' }),
    walletAddress: text('wallet_address').notNull(),
    eventType: transactionEventTypeEnum('event_type').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow()
  },
  (table) => [
    unique('transaction_email_sent_event_user_unique').on(table.eventId, table.userId),
    index('transaction_email_sent_event_idx').on(table.eventId)
  ]
);

export const transactionMonitorCursor = pgTable('transaction_monitor_cursor', {
  flow: transactionEventTypeEnum('flow').primaryKey(),
  lastBlockNumber: bigint('last_block_number', { mode: 'bigint' })
    .notNull()
    .default(sql`0`),
  lastLogIndex: integer('last_log_index').notNull().default(-1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
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
