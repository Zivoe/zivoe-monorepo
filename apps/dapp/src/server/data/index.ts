import { cache } from 'react';

import { eq } from 'drizzle-orm';
import { erc20Abi } from 'viem';

import { getContracts } from '@zivoe/contracts';

import { getWeb3Client } from '@/server/clients/web3';

import { env } from '@/env';

import { getDb } from '../clients/db';
import { getPonder } from '../clients/ponder';
import { occTable } from '../clients/ponder/schema';

const getDepositDailyData = cache(async () => {
  const db = getDb(env.NEXT_PUBLIC_NETWORK);

  const start = Date.now();

  const data = await db.daily.find().toArray();

  const end = Date.now();
  console.log('getDepositDailyData: ', end - start);

  return data.map((item) => ({
    ...item,
    _id: item._id.toString(),
    timestamp: item.timestamp.toUTCString()
  }));
});

export type DepositDailyData = Awaited<ReturnType<typeof getDepositDailyData>>[number];

const getRevenue = async () => {
  const network = env.NEXT_PUBLIC_NETWORK;
  const contracts = getContracts(network);
  const ponder = getPonder(network);

  const start = Date.now();

  const data = await ponder
    .select({ totalRevenue: occTable.totalRevenue })
    .from(occTable)
    .where(eq(occTable.id, contracts.OCC_USDC))
    .limit(1);

  const end = Date.now();
  console.log('getRevenue: ', end - start);

  return data[0]?.totalRevenue ?? 0n;
};

const getAssetAllocation = async () => {
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

  const start = Date.now();

  const [outstandingPrincipal, ...balances] = await Promise.all([
    outstandingPrincipalReq,
    ...usdcBalancesReq,
    ...m0BalancesReq
  ]);

  const end = Date.now();
  console.log('getAssetAllocation: ', end - start);

  const usdcBalances = balances.slice(0, usdcHolders.length);
  const m0Balances = balances.slice(usdcHolders.length);

  return {
    outstandingPrincipal: outstandingPrincipal[0]?.outstandingPrincipal ?? 0n,
    usdcBalance: usdcBalances.reduce((acc, curr) => acc + curr, 0n),
    m0Balance: m0Balances.reduce((acc, curr) => acc + curr, 0n)
  };
};

export const data = {
  getDepositDailyData,
  getRevenue,
  getAssetAllocation
};
