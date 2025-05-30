export const DEPOSIT_TOKENS = ['USDC', 'USDT', 'FRX', 'zSTT'] as const;
export type DepositToken = (typeof DEPOSIT_TOKENS)[number];

export const DEPOSIT_TOKEN_DECIMALS: Record<DepositToken, number> = {
  USDC: 6,
  USDT: 18,
  FRX: 18,
  zSTT: 18
};
