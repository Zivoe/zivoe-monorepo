export type DailyData = {
  timestamp: Date;
  blockNumber: string;
  indexPrice: number;
  apy: number;
  tvl: TVL;
  zSTTTotalSupply: string;
  vaultTotalAssets: bigint;
};

export type TVL = {
  total: string;
  stablecoins: {
    total: string;
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
  };
};
