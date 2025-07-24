import { unstable_cache as nextCache } from 'next/cache';

import { eq } from 'drizzle-orm';

import { getContracts } from '@zivoe/contracts';

import { env } from '@/env.js';

import { getDb } from '../clients/db';
import { getPonder } from '../clients/ponder';
import { occTable } from '../clients/ponder/schema';

export const DEPOSIT_DAILY_DATA_TAG = 'deposit-daily-data';

const network = env.NETWORK;

const getCurrentDailyData = nextCache(
  async () => {
    try {
      const client = getDb(network);

      const [latest] = await client.daily.find().sort({ timestamp: -1 }).limit(1).toArray();
      if (!latest) throw new Error('Error getting daily data');

      return latest;
    } catch (error) {
      return null;
    }
  },
  undefined,
  { tags: [DEPOSIT_DAILY_DATA_TAG] }
);

const getRevenue = nextCache(
  async () => {
    try {
      const contracts = getContracts(network);
      const ponder = getPonder(network);

      const data = await ponder
        .select({ totalRevenue: occTable.totalRevenue })
        .from(occTable)
        .where(eq(occTable.id, contracts.OCC_USDC));

      const totalRevenue = data[0]?.totalRevenue;
      if (!totalRevenue) throw new Error('Error getting revenue');

      return totalRevenue.toString();
    } catch (error) {
      return null;
    }
  },
  undefined,
  { tags: [DEPOSIT_DAILY_DATA_TAG] }
);

export const web3 = {
  getCurrentDailyData,
  getRevenue
};
