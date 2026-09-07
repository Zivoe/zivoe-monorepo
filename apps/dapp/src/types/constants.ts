import { type DepositAssetSymbol, type ShareClassSymbol } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

/** Every catalogued deposit asset symbol — grows with the catalog, never by hand. */
export type DepositToken = DepositAssetSymbol;

/** Every catalogued share token symbol — grows with the catalog, never by hand. */
export type ShareToken = ShareClassSymbol;

/** Any token the product displays — deposit assets and share tokens (the portfolio lists both). */
export type Token = DepositToken | ShareToken;

export const LINKS = {
  TERMS_OF_USE: 'https://docs.zivoe.com/terms/terms-of-use-privacy-policy',
  REG_S_COMPLIANCE: 'https://docs.zivoe.com/terms/reg-s-compliance'
};

export const WITH_TURNSTILE = env.NEXT_PUBLIC_ENV === 'production';
