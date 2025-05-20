import { eq } from 'drizzle-orm';

import { getContracts } from '@zivoe/contracts';

import { env } from '@/env';

import { getDb } from '../clients/db';
import { getPonder } from '../clients/ponder';
import { occTable } from '../clients/ponder/schema';

const getDepositDailyData = async () => {
  const db = getDb({ network: env.NEXT_PUBLIC_NETWORK });
  const data = await db.daily.find().toArray();

  return data.map((item) => ({
    ...item,
    _id: item._id.toString(),
    timestamp: item.timestamp.toUTCString()
  }));
};

export type DepositDailyData = Awaited<ReturnType<typeof getDepositDailyData>>[number];

const getRevenue = async () => {
  const network = env.NEXT_PUBLIC_NETWORK;
  const contracts = getContracts({ network });
  const ponder = getPonder({ network });

  const data = await ponder
    .select({ totalRevenue: occTable.totalRevenue })
    .from(occTable)
    .where(eq(occTable.id, contracts.OCC_USDC));

  return data[0]?.totalRevenue ?? 0n;
};

export const data = {
  getDepositDailyData,
  getRevenue
};
