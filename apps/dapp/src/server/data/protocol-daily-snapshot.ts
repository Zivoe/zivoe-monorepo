import 'server-only';

import { asc, gte, sql } from 'drizzle-orm';

import {
  type ProtocolDailySnapshot,
  protocolDailySnapshot,
  protocolDailySnapshotColumns
} from '@zivoe/database/schema';

import { db } from '@/server/clients/db';

export async function listDepositDailySnapshots({
  since = new Date('2025-06-20')
}: { since?: Date } = {}): Promise<Array<ProtocolDailySnapshot>> {
  return db
    .select(protocolDailySnapshotColumns)
    .from(protocolDailySnapshot)
    .where(gte(protocolDailySnapshot.timestamp, since))
    .orderBy(asc(protocolDailySnapshot.timestamp));
}

export async function listProtocolIndexPrices() {
  return db
    .select({
      timestamp: protocolDailySnapshot.timestamp,
      indexPrice: protocolDailySnapshot.indexPrice
    })
    .from(protocolDailySnapshot)
    .orderBy(asc(protocolDailySnapshot.timestamp));
}

export async function upsertProtocolDailySnapshot(data: ProtocolDailySnapshot) {
  await db
    .insert(protocolDailySnapshot)
    .values(data)
    .onConflictDoUpdate({
      target: protocolDailySnapshot.timestamp,
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

export async function upsertManyProtocolDailySnapshots(data: Array<ProtocolDailySnapshot>) {
  if (data.length === 0) return;

  await db
    .insert(protocolDailySnapshot)
    .values(data)
    .onConflictDoUpdate({
      target: protocolDailySnapshot.timestamp,
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
