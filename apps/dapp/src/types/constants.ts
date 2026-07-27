import { env } from '@/env';

export const DEPOSIT_TOKENS = ['USDC'] as const;
export type DepositToken = (typeof DEPOSIT_TOKENS)[number];

export const DEPOSIT_TOKEN_DECIMALS: Record<DepositToken, number> = {
  USDC: 6
};

export type ShareToken = 'zMCA';

export type Token = DepositToken | ShareToken;

export const TOKEN_DECIMALS: Record<Token, number> = {
  ...DEPOSIT_TOKEN_DECIMALS,
  zMCA: 18
};

export const LINKS = {
  TERMS_OF_USE: 'https://docs.zivoe.com/terms/terms-of-use-privacy-policy',
  REG_S_COMPLIANCE: 'https://docs.zivoe.com/terms/reg-s-compliance'
};

export const WITH_TURNSTILE = env.NEXT_PUBLIC_ENV === 'production';
