export type DailyData = {
  timestamp: Date;
  blockNumber: string;
  indexPrice: number;
  apy: number;
  tvl: string;
  zSTTTotalSupply: string;
  vaultTotalAssets: bigint;
};
