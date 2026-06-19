import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';

import { getLatestProtocolDailySnapshot } from '@zivoe/database';

import { db } from '../clients/db';

export const PROTOCOL_DAILY_SNAPSHOT_TAG = 'protocol-daily-snapshot';

const getCurrentDailySnapshot = reactCache(
  nextCache(
    async () => {
      try {
        const latest = await getLatestProtocolDailySnapshot(db);
        if (!latest) throw new Error('Error getting protocol daily snapshot');

        // unstable_cache serializes the result to JSON, so a Date would come
        // back as a string on cache hits — serialize it explicitly instead.
        return { ...latest, timestamp: latest.timestamp.toUTCString() };
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'SERVER' } });
      }
    },
    undefined,
    { tags: [PROTOCOL_DAILY_SNAPSHOT_TAG] }
  )
);

const getRevenue = nextCache(
  async () => {
    try {
      const latestSnapshot = await getLatestProtocolDailySnapshot(db);
      if (!latestSnapshot?.loansRevenue) return null;

      const { portfolioA, portfolioB } = latestSnapshot.loansRevenue;
      if (portfolioA === null || portfolioB === null) return null;

      const totalRevenue = BigInt(portfolioA) + BigInt(portfolioB);
      return totalRevenue !== 0n ? totalRevenue.toString() : null;
    } catch (error) {
      Sentry.captureException(error, { tags: { source: 'SERVER' } });
    }
  },
  undefined,
  { tags: [PROTOCOL_DAILY_SNAPSHOT_TAG] }
);

export const web3 = {
  getCurrentDailySnapshot,
  getRevenue
};
