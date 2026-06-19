import { index, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';

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
