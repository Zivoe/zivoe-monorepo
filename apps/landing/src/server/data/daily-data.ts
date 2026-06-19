import 'server-only';

import { desc } from 'drizzle-orm';

import { authDb } from '@/server/clients/auth-db';
import { dailyData } from '@/server/db/schema';

import { type DailyData } from '@/types';

export async function getLatestDailyData(): Promise<DailyData | null> {
  const rows = await authDb
    .select({
      timestamp: dailyData.timestamp,
      blockNumber: dailyData.blockNumber,
      indexPrice: dailyData.indexPrice,
      apy: dailyData.apy,
      tvl: dailyData.tvl,
      zSTTTotalSupply: dailyData.zSTTTotalSupply,
      vaultTotalAssets: dailyData.vaultTotalAssets,
      loansRevenue: dailyData.loansRevenue
    })
    .from(dailyData)
    .orderBy(desc(dailyData.timestamp))
    .limit(1);

  return rows[0] ?? null;
}
