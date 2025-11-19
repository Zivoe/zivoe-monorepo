import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';
import { erc20Abi } from 'viem';

import { CONTRACTS } from '@zivoe/contracts';

import { getDb } from '../clients/db';
import { getWeb3Client } from '../clients/web3';

export const DEPOSIT_DAILY_DATA_TAG = 'deposit-daily-data';

const getDepositDailyData = reactCache(
  nextCache(
    async () => {
      try {
        const db = getDb();
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

const getCurrentDailyData = async () => {
  const dailyData = await getDepositDailyData();
  const currentDailyData = dailyData?.[dailyData.length - 1];
  if (!currentDailyData) return null;

  const { total, loans, stablecoins, treasuryBills, deFi } = currentDailyData.tvl;
  const totalNumber = Number(total);

  return {
    ...currentDailyData,
    tvl: {
      total: BigInt(total),
      loans: {
        total: BigInt(loans.total),
        portfolioA: BigInt(loans.portfolioA),
        portfolioB: BigInt(loans.portfolioB),
        percentage: (Number(loans.total) / totalNumber) * 100
      },
      stablecoins: {
        total: BigInt(stablecoins.total),
        total30Days: BigInt(stablecoins.total30Days),
        percentage: (Number(stablecoins.total) / totalNumber) * 100,
        usdc: BigInt(stablecoins.usdc),
        usdt: BigInt(stablecoins.usdt),
        frxUSD: BigInt(stablecoins.frxUSD)
      },
      treasuryBills: {
        total: BigInt(treasuryBills.total),
        percentage: (Number(treasuryBills.total) / totalNumber) * 100,
        m0: BigInt(treasuryBills.m0)
      },
      deFi: {
        total: BigInt(deFi.total),
        percentage: (Number(deFi.total) / totalNumber) * 100,
        aUSDC: BigInt(deFi.aUSDC)
      }
    }
  };
};

export type CurrentDailyData = NonNullable<Awaited<ReturnType<typeof getCurrentDailyData>>>;

const getRevenue = nextCache(
  async () => {
    try {
      const db = getDb();

      const latestData = await db.daily.findOne({}, { sort: { timestamp: -1 } });
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

const getLiquidity = async () => {
  try {
    const client = getWeb3Client();

    const [currentDailyData, uniswap] = await Promise.all([
      getCurrentDailyData(),

      CONTRACTS.UNISWAP_V3_POOL
        ? client.readContract({
            address: CONTRACTS.USDC,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [CONTRACTS.UNISWAP_V3_POOL]
          })
        : Promise.resolve(0n)
    ]);

    if (!currentDailyData) return null;

    const aUSDC = currentDailyData.tvl.deFi.aUSDC;
    const days3 = currentDailyData.tvl.stablecoins.total - currentDailyData.tvl.stablecoins.total30Days;
    const days30 = currentDailyData.tvl.stablecoins.total30Days;

    return {
      aUSDC,
      uniswap,
      days3,
      days30
    };
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'SERVER' } });
  }
};

export type Liquidity = NonNullable<Awaited<ReturnType<typeof getLiquidity>>>;

const getTransparencyLoansData = reactCache(
  nextCache(
    async () => {
      try {
        const db = getDb();

        const latestData = await db.daily.findOne({}, { sort: { timestamp: -1 } });
        if (!latestData?.loansRevenue) return null;

        const { portfolioA: portfolioAInterest, portfolioB: portfolioBInterest } = latestData.loansRevenue;
        if (portfolioAInterest === null || portfolioBInterest === null) return null;

        return {
          portfolioA: {
            interest: portfolioAInterest,
            invested: latestData.tvl.loans.portfolioA
          },
          portfolioB: {
            interest: portfolioBInterest,
            invested: latestData.tvl.loans.portfolioB
          }
        };
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'SERVER' } });
      }
    },
    undefined,
    { tags: [DEPOSIT_DAILY_DATA_TAG] }
  )
);

export const data = {
  getDepositDailyData,
  getCurrentDailyData,
  getRevenue,
  getLiquidity,
  getTransparencyLoansData
};
