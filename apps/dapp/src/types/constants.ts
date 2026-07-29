import { env } from '@/env';

export const DEPOSIT_TOKENS = ['USDC'] as const;
export type DepositToken = (typeof DEPOSIT_TOKENS)[number];

export type ShareToken = 'zMCA';

export type Token = DepositToken | ShareToken;

export const LINKS = {
  TERMS_OF_USE: 'https://docs.zivoe.com/terms/terms-of-use-privacy-policy',
  REG_S_COMPLIANCE: 'https://docs.zivoe.com/terms/reg-s-compliance'
};

export const WITH_TURNSTILE = env.NEXT_PUBLIC_ENV === 'production';
