import { eq } from 'drizzle-orm';

import { getContracts } from '@zivoe/contracts';

import { env } from '@/env.js';

import { getDb } from '../clients/db';
import { getPonder } from '../clients/ponder';
import { occTable } from '../clients/ponder/schema';

const network = env.NETWORK;

const getCurrentDailyData = async () => {
  const client = getDb(network);
  const [latest] = await client.daily.find().sort({ timestamp: -1 }).limit(1).toArray();

  return latest;
};

const getRevenue = async () => {
  const contracts = getContracts(network);
  const ponder = getPonder(network);

  const data = await ponder
    .select({ totalRevenue: occTable.totalRevenue })
    .from(occTable)
    .where(eq(occTable.id, contracts.OCC_USDC));

  return data[0]?.totalRevenue ?? 0n;
};

export const web3 = {
  getCurrentDailyData,

  getRevenue
};
