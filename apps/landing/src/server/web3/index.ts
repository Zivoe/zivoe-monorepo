import { unstable_cacheLife as cacheLife } from 'next/cache';

import { eq } from 'drizzle-orm';

import { getContracts } from '@zivoe/contracts';
import { zivoeGlobalsAbi } from '@zivoe/contracts/abis';

import { env } from '@/env.js';

import { getDb } from '../clients/db';
import { getPonder } from '../clients/ponder';
import { occTable } from '../clients/ponder/schema';
import { getWeb3Client } from '../clients/web3';

const network = env.NETWORK;

const getTVL = async () => {
  'use cache';
  cacheLife({ stale: 600, revalidate: 1800, expire: 3600 });

  const client = getWeb3Client(network);
  const contracts = getContracts(network);

  const totalSupply = await client.readContract({
    address: contracts.GBL,
    abi: zivoeGlobalsAbi,
    functionName: 'adjustedSupplies'
  });

  return totalSupply[0] + totalSupply[1];
};

const getAPY = async () => {
  'use cache';
  cacheLife({ stale: 600, revalidate: 1800, expire: 3600 });

  const client = getDb(network);
  const [latest] = await client.daily.find().sort({ timestamp: -1 }).limit(1).toArray();

  return latest?.apy;
};

const getRevenue = async () => {
  'use cache';
  cacheLife({ stale: 600, revalidate: 1800, expire: 3600 });

  const contracts = getContracts(network);
  const ponder = getPonder(network);

  const data = await ponder
    .select({ totalRevenue: occTable.totalRevenue })
    .from(occTable)
    .where(eq(occTable.id, contracts.OCC_USDC));

  return data[0]?.totalRevenue ?? 0n;
};

export const web3 = {
  getTVL,
  getAPY,
  getRevenue
};
