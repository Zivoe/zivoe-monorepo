import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import * as Sentry from '@sentry/nextjs';
import { erc20Abi } from 'viem';

import { CONTRACTS } from '@zivoe/contracts';
import { getLatestProtocolDailySnapshot } from '@zivoe/database';

import { db } from '../clients/db';
import { getWeb3Client } from '../clients/web3';
import { listDepositDailySnapshots } from './protocol-daily-snapshot';

export const PROTOCOL_DAILY_SNAPSHOT_TAG = 'protocol-daily-snapshot';

const toPercentage = (value: string, total: number) => {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return (Number(value) / total) * 100;
};

const getDepositDailySnapshots = reactCache(
  nextCache(
    async () => {
      try {
        const snapshots = await listDepositDailySnapshots();

        if (snapshots.length === 0) throw new Error('No protocol daily snapshots found');

        return snapshots.map((item) => ({
          ...item,
          timestamp: item.timestamp.toUTCString()
        }));
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'SERVER' } });
      }
    },
    undefined,
    { tags: [PROTOCOL_DAILY_SNAPSHOT_TAG] }
  )
);

export type DepositDailySnapshot = NonNullable<Awaited<ReturnType<typeof getDepositDailySnapshots>>>[number];

const getCurrentDailySnapshot = async () => {
  const snapshots = await getDepositDailySnapshots();
  const currentSnapshot = snapshots?.[snapshots.length - 1];
  if (!currentSnapshot) return null;

  const { total, loans, stablecoins, treasuryBills, deFi } = currentSnapshot.tvl;
  const totalNumber = Number(total);

  return {
    ...currentSnapshot,
    tvl: {
      total: BigInt(total),
      loans: {
        total: BigInt(loans.total),
        portfolioA: BigInt(loans.portfolioA),
        portfolioB: BigInt(loans.portfolioB),
        percentage: toPercentage(loans.total, totalNumber)
      },
      stablecoins: {
        total: BigInt(stablecoins.total),
        total30Days: BigInt(stablecoins.total30Days),
        percentage: toPercentage(stablecoins.total, totalNumber),
        usdc: BigInt(stablecoins.usdc),
        usdcInOCRCycleV2: BigInt(stablecoins.usdcInOCRCycleV2 ?? 0),
        usdt: BigInt(stablecoins.usdt),
        frxUSD: BigInt(stablecoins.frxUSD)
      },
      treasuryBills: {
        total: BigInt(treasuryBills.total),
        percentage: toPercentage(treasuryBills.total, totalNumber),
        m0: BigInt(treasuryBills.m0)
      },
      deFi: {
        total: BigInt(deFi.total),
        percentage: toPercentage(deFi.total, totalNumber),
        aUSDC: BigInt(deFi.aUSDC)
      }
    }
  };
};

export type CurrentDailySnapshot = NonNullable<Awaited<ReturnType<typeof getCurrentDailySnapshot>>>;

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

const getLiquidity = async () => {
  try {
    const client = getWeb3Client();

    const [currentSnapshot, uniswap] = await Promise.all([
      getCurrentDailySnapshot(),

      CONTRACTS.UNISWAP_V3_POOL
        ? client.readContract({
            address: CONTRACTS.USDC,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [CONTRACTS.UNISWAP_V3_POOL]
          })
        : Promise.resolve(0n)
    ]);

    if (!currentSnapshot) return null;

    const redeemUSDC = currentSnapshot.tvl.stablecoins.usdcInOCRCycleV2;
    const days3Raw = currentSnapshot.tvl.stablecoins.total - currentSnapshot.tvl.stablecoins.total30Days - redeemUSDC;
    const days3 = days3Raw > 0n ? days3Raw : 0n;
    const days30 = currentSnapshot.tvl.stablecoins.total30Days;

    return {
      redeemUSDC,
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
        const latestSnapshot = await getLatestProtocolDailySnapshot(db);
        if (!latestSnapshot?.loansRevenue) return null;

        const { portfolioA: portfolioAInterest, portfolioB: portfolioBInterest } = latestSnapshot.loansRevenue;
        if (portfolioAInterest === null || portfolioBInterest === null) return null;

        return {
          portfolioA: {
            interest: portfolioAInterest,
            invested: latestSnapshot.tvl.loans.portfolioA
          },
          portfolioB: {
            interest: portfolioBInterest,
            invested: latestSnapshot.tvl.loans.portfolioB
          }
        };
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'SERVER' } });
      }
    },
    undefined,
    { tags: [PROTOCOL_DAILY_SNAPSHOT_TAG] }
  )
);

export const data = {
  getDepositDailySnapshots,
  getCurrentDailySnapshot,
  getRevenue,
  getLiquidity,
  getTransparencyLoansData
};
