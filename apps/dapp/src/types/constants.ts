export const DEPOSIT_TOKENS = ['USDC', 'USDT', 'frxUSD', 'zSTT'] as const;
export type DepositToken = (typeof DEPOSIT_TOKENS)[number];

export const DEPOSIT_TOKEN_DECIMALS: Record<DepositToken, number> = {
  USDC: 6,
  USDT: 6,
  frxUSD: 18,
  zSTT: 18
};

export type RedeemToken = 'zVLT';

export type Token = DepositToken | RedeemToken;

export const TOKEN_DECIMALS: Record<Token, number> = {
  ...DEPOSIT_TOKEN_DECIMALS,
  zVLT: 18
};
