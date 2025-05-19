import { env } from '@/env';

import { getDb } from '../clients/db';

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

export const data = {
  getDepositDailyData
};
