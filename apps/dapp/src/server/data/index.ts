import { unstable_cacheLife as cacheLife } from 'next/cache';

import { eq } from 'drizzle-orm';

import { getContracts } from '@zivoe/contracts';
import { mockStablecoinAbi } from '@zivoe/contracts/abis';

import { getWeb3Client } from '@/server/clients/web3';

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

const getOutstandingPrincipal = async () => {
  const network = env.NEXT_PUBLIC_NETWORK;
  const contracts = getContracts({ network });
  const ponder = getPonder({ network });

  const data = await ponder
    .select({ outstandingPrincipal: occTable.outstandingPrincipal })
    .from(occTable)
    .where(eq(occTable.id, contracts.OCC_USDC));

  return data[0]?.outstandingPrincipal ?? 0n;
};

const getAssetAllocation = async () => {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 3600, expire: 3600 });

  const network = env.NEXT_PUBLIC_NETWORK;
  const client = getWeb3Client({ network });
  const contracts = getContracts({ network });

  const daoBalance = client.readContract({
    address: contracts.USDC,
    abi: mockStablecoinAbi,
    functionName: 'balanceOf',
    args: [contracts.DAO]
  });

  const occUsdcBalance = client.readContract({
    address: contracts.USDC,
    abi: mockStablecoinAbi,
    functionName: 'balanceOf',
    args: [contracts.OCC_USDC]
  });

  const vaultBalance = client.readContract({
    address: contracts.USDC,
    abi: mockStablecoinAbi,
    functionName: 'balanceOf',
    args: [contracts.ZIVOE_VAULT]
  });

  const octConvertBalance = client.readContract({
    address: contracts.USDC,
    abi: mockStablecoinAbi,
    functionName: 'balanceOf',
    args: [contracts.OCT_CONVERT]
  });

  const usdcBalances = await Promise.all([daoBalance, occUsdcBalance, vaultBalance, octConvertBalance]);
  const usdcBalance = usdcBalances.reduce((acc, curr) => acc + curr, 0n);
  return { usdcBalance };
};

export const data = {
  getDepositDailyData,
  getRevenue,
  getOutstandingPrincipal,
  getAssetAllocation
};
