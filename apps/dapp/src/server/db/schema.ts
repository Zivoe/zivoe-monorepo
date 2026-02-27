import { sql } from 'drizzle-orm';
import { bigint, index, integer, numeric, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth-schema';

export const accountTypeEnum = pgEnum('account_type', ['individual', 'organization']);
export type AccountType = (typeof accountTypeEnum.enumValues)[number];

export const individualAmountValues = ['1k_10k', '10k_100k', '100k_250k', '250k_1m', 'over_1m'] as const;
export type IndividualAmountOfInterest = (typeof individualAmountValues)[number];

export const orgAmountValues = ['under_10k', '10k_100k', '100k_250k', '250k_1m', '1m_5m', 'over_5m'] as const;
export type OrgAmountOfInterest = (typeof orgAmountValues)[number];

export const amountOfInterestValues = [
  // Individual
  ...individualAmountValues,
  // Organization (unique values only, shared ones above)
  'under_10k',
  '1m_5m',
  'over_5m'
] as const;
export const amountOfInterestEnum = pgEnum('amount_of_interest', amountOfInterestValues);
export type AmountOfInterest = (typeof amountOfInterestValues)[number];

export const howFoundZivoeValues = [
  'x_twitter',
  'linkedin',
  'google_search',
  'media_coverage',
  'conference_event',
  'word_of_mouth',
  'other'
] as const;
export const howFoundZivoeEnum = pgEnum('how_found_zivoe', howFoundZivoeValues);
export type HowFoundZivoe = (typeof howFoundZivoeValues)[number];

export const transactionEventTypeValues = ['deposit', 'redemption'] as const;
export const transactionEventTypeEnum = pgEnum('transaction_event_type', transactionEventTypeValues);
export type TransactionEventType = (typeof transactionEventTypeValues)[number];

export const profile = pgTable('profile', {
  id: uuid('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  // Personal required fields (set during onboarding)
  accountType: accountTypeEnum('account_type').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  amountOfInterest: amountOfInterestEnum('amount_of_interest').notNull(),
  howFoundZivoe: howFoundZivoeEnum('how_found_zivoe').notNull(),

  // Individual-specific
  countryOfResidence: text('country_of_residence'),

  // Organization-specific
  jobTitle: text('job_title'),
  entityName: text('entity_name'),
  countryOfIncorporation: text('country_of_incorporation'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

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

/**
 * Tracks which transaction emails have been sent to prevent duplicates.
 * Uses eventId (txHash:logIndex) + userId as unique constraint.
 */
export const transactionEmailSent = pgTable(
  'transaction_email_sent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: text('event_id').notNull(), // `${txHash}:${logIndex}`
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

/**
 * Stores the last processed onchain event cursor for each monitor flow.
 * Cursor is represented by (blockNumber, logIndex).
 */
export const transactionMonitorCursor = pgTable('transaction_monitor_cursor', {
  flow: transactionEventTypeEnum('flow').primaryKey(),
  lastBlockNumber: bigint('last_block_number', { mode: 'bigint' })
    .notNull()
    .default(sql`0`),
  lastLogIndex: integer('last_log_index').notNull().default(-1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export * from './auth-schema';
