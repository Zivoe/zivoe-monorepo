import { PublicClient } from 'viem';

import { Contracts } from '@zivoe/contracts';

export type Web3Request = {
  client: PublicClient;
  contracts: Contracts;
  blockNumber: bigint;
};

export type DailyData = {
  timestamp: Date;
  blockNumber: string;
  indexPrice: number;
  apy: number;
  tvl: string;
  zSTTTotalSupply: string;
  vaultTotalAssets: bigint;
};
