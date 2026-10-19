import { type DepositAssetSymbol, type ShareClassSymbol } from '@zivoe/centrifuge-indexer';
import { legalDocUrl } from '@zivoe/ui/lib/legal-docs';

import { env } from '@/env';

/** Every catalogued deposit asset symbol — grows with the catalog, never by hand. */
export type DepositToken = DepositAssetSymbol;

/** Every catalogued share token symbol — grows with the catalog, never by hand. */
export type ShareToken = ShareClassSymbol;

/** Any token the product displays — deposit assets and share tokens (the portfolio lists both). */
export type Token = DepositToken | ShareToken;

/** The legal PDFs in force (LATEST_LEGAL_DOCS_VERSION). */
export const LINKS = {
  TERMS_OF_USE: legalDocUrl({ doc: 'termsOfUse' }),
  PRIVACY_POLICY: legalDocUrl({ doc: 'privacyPolicy' }),
  ELECTRONIC_CONSENT: legalDocUrl({ doc: 'electronicConsent' })
};

export const WITH_TURNSTILE = env.NEXT_PUBLIC_ENV === 'production';
