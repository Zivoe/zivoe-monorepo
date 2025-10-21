import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { env } from '@/env.js';

import { getDb } from '../clients/db';

export const DEPOSIT_DAILY_DATA_TAG = 'deposit-daily-data';

const network = env.NETWORK;

const getCurrentDailyData = reactCache(
  nextCache(
    async () => {
      try {
        const client = getDb(network);

        const [latest] = await client.daily.find().sort({ timestamp: -1 }).limit(1).toArray();
        if (!latest) throw new Error('Error getting daily data');

        return latest;
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'SERVER' } });
      }
    },
    undefined,
    { tags: [DEPOSIT_DAILY_DATA_TAG] }
  )
);

const getRevenue = nextCache(
  async () => {
    try {
      const db = getDb(network);

      const latestData = await db.daily.findOne({}, { sort: { timestamp: -1 } });
      if (!latestData?.loansRevenue) return null;

      const { zinclusive, newCo } = latestData.loansRevenue;
      if (zinclusive === null || newCo === null) return null;

      const totalRevenue = BigInt(zinclusive) + BigInt(newCo);
      return totalRevenue !== 0n ? totalRevenue.toString() : null;
    } catch (error) {
      Sentry.captureException(error, { tags: { source: 'SERVER' } });
    }
  },
  undefined,
  { tags: [DEPOSIT_DAILY_DATA_TAG] }
);

export const web3 = {
  getCurrentDailyData,
  getRevenue
};
