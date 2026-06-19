import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const safelist = pgTable(
  'safelist',
  {
    walletAddress: text('wallet_address').primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check('safelist_wallet_address_lowercase_check', sql`${table.walletAddress} = lower(${table.walletAddress})`)
  ]
);
