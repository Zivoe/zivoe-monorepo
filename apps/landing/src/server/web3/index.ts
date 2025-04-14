import { getContracts } from '@zivoe/contracts';
import { zivoeGlobalsAbi } from '@zivoe/contracts/abis';

import { env } from '@/env.js';

import { getDb } from '../clients/db';
import { getWeb3Client } from '../clients/web3';

const network = env.NETWORK;

const getTVL = async () => {
  const client = getWeb3Client({ network });
  const contracts = getContracts({ network });

  const totalSupply = await client.readContract({
    address: contracts.GBL,
    abi: zivoeGlobalsAbi,
    functionName: 'adjustedSupplies'
  });

  return totalSupply[0] + totalSupply[1];
};

const getAPY = async () => {
  const client = getDb({ network });
  const [latest] = await client.daily.find().sort({ timestamp: -1 }).limit(1).toArray();

  return latest?.apy;
};

export const web3 = {
  getTVL,
  getAPY
};
