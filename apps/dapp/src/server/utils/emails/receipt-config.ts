import 'server-only';

import { type DepositAssetSymbol, type ShareClassSymbol } from '@zivoe/centrifuge-indexer';

import { BASE_URL } from '@/server/utils/base-url';

// Token icon URLs (self-hosted PNGs in public/email-icons/), keyed by the
// catalog's symbols so a new stablecoin or share class fails the build until
// it has an icon here — the runbook's step 2, enforced like token-info.tsx.
const TOKEN_ICON_URL_BY_SYMBOL: Record<DepositAssetSymbol | ShareClassSymbol, string> = {
  USDC: `${BASE_URL}/email-icons/usdc.png`,
  USDT: `${BASE_URL}/email-icons/usdt.png`,
  USD1: `${BASE_URL}/email-icons/usd1.png`,
  EURC: `${BASE_URL}/email-icons/eurc.png`,
  zSMB: `${BASE_URL}/email-icons/zsmb.png`
};

// Fresh literal so the union-keyed record widens to the runtime symbol strings a payload carries.
const TOKEN_ICON_URL: Record<string, string | undefined> = { ...TOKEN_ICON_URL_BY_SYMBOL };

export function getReceiptTokenIconUrl(tokenSymbol: string): string | null {
  return (Object.hasOwn(TOKEN_ICON_URL, tokenSymbol) ? TOKEN_ICON_URL[tokenSymbol] : undefined) ?? null;
}

export const RECEIPT_ARROW_RIGHT_GRAY_URL = `${BASE_URL}/email-icons/arrow-right-gray.png`;
export const RECEIPT_ARROW_DOWN_GRAY_URL = `${BASE_URL}/email-icons/arrow-down-gray.png`;
export const RECEIPT_ARROW_RIGHT_TEAL_URL = `${BASE_URL}/email-icons/arrow-right-teal.png`;
export const RECEIPT_CHECK_CIRCLE_URL = `${BASE_URL}/email-icons/check-circle.png`;
export const RECEIPT_EXTERNAL_LINK_URL = `${BASE_URL}/email-icons/external-link.png`;
