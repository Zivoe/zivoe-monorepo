import { doublePrecision, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

type ProtocolDailySnapshotTvl = {
  total: string;
  stablecoins: {
    total: string;
    total30Days: string;
    usdc: string;
    usdcInOCRCycleV2: string;
    usdt: string;
    frxUSD: string;
  };
  treasuryBills: {
    total: string;
    m0: string;
  };
  deFi: {
    total: string;
    aUSDC: string;
  };
  loans: {
    total: string;
    portfolioA: string;
    portfolioB: string;
  };
};

type ProtocolDailySnapshotLoansRevenue = {
  portfolioA: string | null;
  portfolioB: string | null;
};

export const protocolDailySnapshot = pgTable('daily_data', {
  timestamp: timestamp('timestamp', { withTimezone: true }).primaryKey(),
  blockNumber: text('block_number').notNull(),
  indexPrice: doublePrecision('index_price').notNull(),
  apy: doublePrecision('apy').notNull(),
  tvl: jsonb('tvl').$type<ProtocolDailySnapshotTvl>().notNull(),
  zSTTTotalSupply: text('zstt_total_supply').notNull(),
  vaultTotalAssets: text('vault_total_assets').notNull(),
  loansRevenue: jsonb('loans_revenue').$type<ProtocolDailySnapshotLoansRevenue>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const protocolDailySnapshotColumns = {
  timestamp: protocolDailySnapshot.timestamp,
  blockNumber: protocolDailySnapshot.blockNumber,
  indexPrice: protocolDailySnapshot.indexPrice,
  apy: protocolDailySnapshot.apy,
  tvl: protocolDailySnapshot.tvl,
  zSTTTotalSupply: protocolDailySnapshot.zSTTTotalSupply,
  vaultTotalAssets: protocolDailySnapshot.vaultTotalAssets,
  loansRevenue: protocolDailySnapshot.loansRevenue
};

export type ProtocolDailySnapshot = Pick<
  typeof protocolDailySnapshot.$inferSelect,
  keyof typeof protocolDailySnapshotColumns
>;
export type TVL = ProtocolDailySnapshot['tvl'];
