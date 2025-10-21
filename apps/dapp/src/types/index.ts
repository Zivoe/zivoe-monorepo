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
  tvl: TVL;
  zSTTTotalSupply: string;
  vaultTotalAssets: string;
  loansRevenue: {
    zinclusive: string | null;
    newCo: string | null;
  };
};

export type TVL = {
  total: string;
  stablecoins: {
    total: string;
    total30Days: string;
    usdc: string;
    usdt: string;
    frxUSD: string;
  };
  treasuryBills: {
    total: string;
    m0: string;
  };
  deFi: {
    total: string;
    aUSDC: string;
  };
  loans: {
    total: string;
    zinclusive: string;
    newCo: string;
  };
};
