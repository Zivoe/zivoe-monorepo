import { formatUnits, parseUnits } from 'viem';

import { zivoeTrancheTokenAbi } from '@zivoe/contracts/abis';
import { zivoeGlobalsAbi } from '@zivoe/contracts/abis';
import { zivoeRewardsAbi, zivoeVaultAbi } from '@zivoe/contracts/abis';

import { DAYS_PER_YEAR } from '@/lib/utils';
import { DAY_IN_SECONDS } from '@/lib/utils';

import { Web3Request } from '@/types';

const getIndexPrice = async ({ client, contracts, blockNumber }: Web3Request) => {
  const totalSupply = await client.readContract({
    address: contracts.ZIVOE_VAULT,
    abi: zivoeVaultAbi,
    functionName: 'totalSupply',
    blockNumber
  });

  const vaultTotalAssets = await client.readContract({
    address: contracts.ZIVOE_VAULT,
    abi: zivoeVaultAbi,
    functionName: 'totalAssets',
    blockNumber
  });

  const amount = parseUnits(vaultTotalAssets.toString(), 6);
  const indexPrice = totalSupply !== 0n ? Number(formatUnits(amount / totalSupply, 6)) : 0;

  return { indexPrice, vaultTotalAssets };
};

const COMPOUNDING_PERIOD = 15;

const getAPY = async ({ client, contracts, blockNumber }: Web3Request) => {
  const rewardRateRes = await client.readContract({
    address: contracts.stSTT,
    abi: zivoeRewardsAbi,
    functionName: 'rewardData',
    args: [contracts.USDC],
    blockNumber
  });

  const totalSupplyRes = await client.readContract({
    address: contracts.stSTT,
    abi: zivoeRewardsAbi,
    functionName: 'totalSupply',
    blockNumber
  });

  const rewardRate = Number(rewardRateRes[2]);
  const totalSupply = Number(totalSupplyRes);

  const rewardRatePerDay = rewardRate * DAY_IN_SECONDS;
  const rewardRatePerYear = rewardRatePerDay * DAYS_PER_YEAR;
  const apr = rewardRatePerYear / totalSupply;

  const dailyRate = apr / DAYS_PER_YEAR;
  const periodRate = dailyRate * COMPOUNDING_PERIOD;
  const periodsPerYear = DAYS_PER_YEAR / COMPOUNDING_PERIOD;
  const apy = ((1 + periodRate) ** periodsPerYear - 1) * 100;

  return Number(apy.toFixed(6));
};

const getTVL = async ({ client, contracts, blockNumber }: Web3Request) => {
  const totalSupply = await client.readContract({
    address: contracts.GBL,
    abi: zivoeGlobalsAbi,
    functionName: 'adjustedSupplies',
    blockNumber
  });

  return totalSupply[0] + totalSupply[1];
};

const getZSTTTotalSupply = async ({ client, contracts, blockNumber }: Web3Request) => {
  const totalSupply = await client.readContract({
    address: contracts.zSTT,
    abi: zivoeTrancheTokenAbi,
    functionName: 'totalSupply',
    blockNumber
  });

  return totalSupply;
};

export const web3 = {
  getIndexPrice,
  getAPY,
  getTVL,
  getZSTTTotalSupply
};
