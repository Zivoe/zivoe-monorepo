import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { getLatestDailyData } from '../data/daily-data';

export const DEPOSIT_DAILY_DATA_TAG = 'deposit-daily-data';

const getCurrentDailyData = reactCache(
  nextCache(
    async () => {
      try {
        const latest = await getLatestDailyData();
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
      const latestData = await getLatestDailyData();
      if (!latestData?.loansRevenue) return null;

      const { portfolioA, portfolioB } = latestData.loansRevenue;
      if (portfolioA === null || portfolioB === null) return null;

      const totalRevenue = BigInt(portfolioA) + BigInt(portfolioB);
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
