import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';

import { getContracts } from '@zivoe/contracts';

import { env } from '@/env';

import { getDb } from '../clients/db';
import { getPonder } from '../clients/ponder';
import { occ } from '../clients/ponder/schema';

export const DEPOSIT_DAILY_DATA_TAG = 'deposit-daily-data';

const getDepositDailyData = reactCache(
  nextCache(
    async () => {
      try {
        const db = getDb(env.NEXT_PUBLIC_NETWORK);
        const data = await db.daily
          .find({ timestamp: { $gte: new Date('2025-06-20') } })
          .sort({ timestamp: 1 })
          .toArray();

        if (data.length === 0) throw new Error('No daily data found');

        return data.map((item) => ({
          ...item,
          _id: item._id.toString(),
          timestamp: item.timestamp.toUTCString()
        }));
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'SERVER' } });
      }
    },
    undefined,
    { tags: [DEPOSIT_DAILY_DATA_TAG] }
  )
);

export type DepositDailyData = NonNullable<Awaited<ReturnType<typeof getDepositDailyData>>>[number];

const getRevenue = nextCache(
  async () => {
    try {
      const network = env.NEXT_PUBLIC_NETWORK;
      const contracts = getContracts(network);
      const ponder = getPonder(network);

      const data = await ponder
        .select({ totalRevenue: occ.totalRevenue })
        .from(occ)
        .where(eq(occ.id, contracts.OCC_USDC))
        .limit(1);

      const totalRevenue = data[0]?.totalRevenue;
      return totalRevenue && totalRevenue !== 0n ? totalRevenue.toString() : null;
    } catch (error) {
      Sentry.captureException(error, { tags: { source: 'SERVER' } });
    }
  },
  undefined,
  { tags: [DEPOSIT_DAILY_DATA_TAG] }
);

export const data = {
  getDepositDailyData,
  getRevenue
};
