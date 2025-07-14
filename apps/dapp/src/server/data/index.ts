import 'server-only';

import { cache as reactCache } from 'react';

import { unstable_cache as nextCache } from 'next/cache';

import { eq } from 'drizzle-orm';
import { erc20Abi } from 'viem';

import { getContracts } from '@zivoe/contracts';

import { getWeb3Client } from '@/server/clients/web3';

import { env } from '@/env';

import { getDb } from '../clients/db';
import { getPonder } from '../clients/ponder';
import { occTable } from '../clients/ponder/schema';

export const DEPOSIT_DAILY_DATA_TAG = 'deposit-daily-data';

const getDepositDailyData = reactCache(
  nextCache(
    async () => {
      const db = getDb(env.NEXT_PUBLIC_NETWORK);
      const data = await db.daily.find().sort({ timestamp: 1 }).toArray();

      return data.map((item) => ({
        ...item,
        _id: item._id.toString(),
        timestamp: item.timestamp.toUTCString()
      }));
    },
    undefined,
    { tags: [DEPOSIT_DAILY_DATA_TAG] }
  )
);

export type DepositDailyData = Awaited<ReturnType<typeof getDepositDailyData>>[number];

const getRevenue = nextCache(
  async () => {
    const network = env.NEXT_PUBLIC_NETWORK;
    const contracts = getContracts(network);
    const ponder = getPonder(network);

    const data = await ponder
      .select({ totalRevenue: occTable.totalRevenue })
      .from(occTable)
      .where(eq(occTable.id, contracts.OCC_USDC))
      .limit(1);

    const totalRevenue = data[0]?.totalRevenue;
    return totalRevenue ? totalRevenue.toString() : '0';
  },
  undefined,
  { tags: [DEPOSIT_DAILY_DATA_TAG] }
);

const getAssetAllocation = nextCache(
  async () => {
    const network = env.NEXT_PUBLIC_NETWORK;
    const client = getWeb3Client(network);
    const contracts = getContracts(network);
    const ponder = getPonder(network);

    const outstandingPrincipalReq = ponder
      .select({ outstandingPrincipal: occTable.outstandingPrincipal })
      .from(occTable)
      .where(eq(occTable.id, contracts.OCC_USDC))
      .limit(1);

    const usdcHolders = [contracts.DAO, contracts.OCC_USDC, contracts.zVLT, contracts.OCT_CONVERT, contracts.OCT_DAO];

    const usdcBalancesReq = usdcHolders.map((address) =>
      client.readContract({
        address: contracts.USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address]
      })
    );

    const m0Holders = [contracts.DAO, contracts.OCT_CONVERT, contracts.OCT_DAO];

    const m0BalancesReq = m0Holders.map((address) =>
      client.readContract({
        address: contracts.M0,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address]
      })
    );

    const [outstandingPrincipalRes, ...balancesRes] = await Promise.all([
      outstandingPrincipalReq,
      ...usdcBalancesReq,
      ...m0BalancesReq
    ]);

    const usdcBalances = balancesRes.slice(0, usdcHolders.length);
    const m0Balances = balancesRes.slice(usdcHolders.length);

    const outstandingPrincipal = outstandingPrincipalRes[0]?.outstandingPrincipal;
    const usdtBalance = usdcBalances.reduce((acc, curr) => acc + curr, 0n);
    const m0Balance = m0Balances.reduce((acc, curr) => acc + curr, 0n);

    return {
      outstandingPrincipal: outstandingPrincipal ? outstandingPrincipal.toString() : '0',
      usdcBalance: usdtBalance.toString(),
      m0Balance: m0Balance.toString()
    };
  },
  undefined,
  { tags: [DEPOSIT_DAILY_DATA_TAG] }
);

export const data = {
  getDepositDailyData,
  getRevenue,
  getAssetAllocation
};
