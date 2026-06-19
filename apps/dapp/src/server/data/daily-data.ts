import 'server-only';

import { asc, desc, gte, sql } from 'drizzle-orm';

import { authDb } from '@/server/clients/auth-db';
import { dailyData } from '@/server/db/schema';

import { type DailyData } from '@/types';

const dailyDataColumns = {
  timestamp: dailyData.timestamp,
  blockNumber: dailyData.blockNumber,
  indexPrice: dailyData.indexPrice,
  apy: dailyData.apy,
  tvl: dailyData.tvl,
  zSTTTotalSupply: dailyData.zSTTTotalSupply,
  vaultTotalAssets: dailyData.vaultTotalAssets,
  loansRevenue: dailyData.loansRevenue
};

export async function listDepositDailyData({
  since = new Date('2025-06-20')
}: { since?: Date } = {}): Promise<Array<DailyData>> {
  return authDb
    .select(dailyDataColumns)
    .from(dailyData)
    .where(gte(dailyData.timestamp, since))
    .orderBy(asc(dailyData.timestamp));
}

export async function getLatestDailyData(): Promise<DailyData | null> {
  const rows = await authDb.select(dailyDataColumns).from(dailyData).orderBy(desc(dailyData.timestamp)).limit(1);
  return rows[0] ?? null;
}

export async function listDailyIndexPrices() {
  return authDb
    .select({
      timestamp: dailyData.timestamp,
      indexPrice: dailyData.indexPrice
    })
    .from(dailyData)
    .orderBy(asc(dailyData.timestamp));
}

export async function upsertDailyData(data: DailyData) {
  await authDb
    .insert(dailyData)
    .values(data)
    .onConflictDoUpdate({
      target: dailyData.timestamp,
      set: {
        blockNumber: data.blockNumber,
        indexPrice: data.indexPrice,
        apy: data.apy,
        tvl: data.tvl,
        zSTTTotalSupply: data.zSTTTotalSupply,
        vaultTotalAssets: data.vaultTotalAssets,
        loansRevenue: data.loansRevenue,
        updatedAt: sql`now()`
      }
    });
}

export async function upsertManyDailyData(data: Array<DailyData>) {
  if (data.length === 0) return;

  await authDb
    .insert(dailyData)
    .values(data)
    .onConflictDoUpdate({
      target: dailyData.timestamp,
      set: {
        blockNumber: sql`excluded.block_number`,
        indexPrice: sql`excluded.index_price`,
        apy: sql`excluded.apy`,
        tvl: sql`excluded.tvl`,
        zSTTTotalSupply: sql`excluded.zstt_total_supply`,
        vaultTotalAssets: sql`excluded.vault_total_assets`,
        loansRevenue: sql`excluded.loans_revenue`,
        updatedAt: sql`now()`
      }
    });
}
