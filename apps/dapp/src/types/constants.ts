import { env } from '@/env';

export const DEPOSIT_TOKENS = ['USDC', 'USDT', 'frxUSD', 'zSTT'] as const;
export type DepositToken = (typeof DEPOSIT_TOKENS)[number];

export const DEPOSIT_TOKEN_DECIMALS: Record<DepositToken, number> = {
  USDC: 6,
  USDT: 6,
  frxUSD: 18,
  zSTT: 18
};

export type RedeemToken = 'zVLT';

export type UnstakeToken = 'stSTT';

export type Token = DepositToken | RedeemToken | UnstakeToken;

export const TOKEN_DECIMALS: Record<Token, number> = {
  ...DEPOSIT_TOKEN_DECIMALS,
  zVLT: 18,
  stSTT: 18
};

export const LINKS = {
  TERMS_OF_USE: 'https://docs.zivoe.com/terms/terms-of-use-privacy-policy',
  REG_S_COMPLIANCE: 'https://docs.zivoe.com/terms/reg-s-compliance'
};

export const WITH_TURNSTILE = env.NEXT_PUBLIC_ENV === 'production';
