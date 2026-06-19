import { doublePrecision, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { type DailyData, type TVL } from '../../types';

type LoansRevenue = DailyData['loansRevenue'];

export const dailyData = pgTable('daily_data', {
  timestamp: timestamp('timestamp', { withTimezone: true }).primaryKey(),
  blockNumber: text('block_number').notNull(),
  indexPrice: doublePrecision('index_price').notNull(),
  apy: doublePrecision('apy').notNull(),
  tvl: jsonb('tvl').$type<TVL>().notNull(),
  zSTTTotalSupply: text('zstt_total_supply').notNull(),
  vaultTotalAssets: text('vault_total_assets').notNull(),
  loansRevenue: jsonb('loans_revenue').$type<LoansRevenue>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
