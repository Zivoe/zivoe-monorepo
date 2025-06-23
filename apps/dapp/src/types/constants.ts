export const DEPOSIT_TOKENS = ['USDC', 'USDT', 'frxUSD', 'zSTT'] as const;
export type DepositToken = (typeof DEPOSIT_TOKENS)[number];

export const DEPOSIT_TOKEN_DECIMALS: Record<DepositToken, number> = {
  USDC: 6,
  USDT: 6,
  frxUSD: 18,
  zSTT: 18
};
