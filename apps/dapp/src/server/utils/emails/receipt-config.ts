import 'server-only';

import { BASE_URL } from '@/server/utils/base-url';

// Token icon URLs (self-hosted PNGs in public/email-icons/). Keyed by display
// symbol; a symbol without an icon renders as text only, so a new share class
// degrades gracefully instead of breaking its receipts.
const TOKEN_ICON_URL_BY_SYMBOL: Record<string, string> = {
  USDC: `${BASE_URL}/email-icons/usdc.png`,
  zSMB: `${BASE_URL}/email-icons/zsmb.png`
};

export function getReceiptTokenIconUrl(tokenSymbol: string): string | null {
  return TOKEN_ICON_URL_BY_SYMBOL[tokenSymbol] ?? null;
}

export const RECEIPT_ARROW_RIGHT_GRAY_URL = `${BASE_URL}/email-icons/arrow-right-gray.png`;
export const RECEIPT_ARROW_DOWN_GRAY_URL = `${BASE_URL}/email-icons/arrow-down-gray.png`;
export const RECEIPT_ARROW_RIGHT_TEAL_URL = `${BASE_URL}/email-icons/arrow-right-teal.png`;
export const RECEIPT_CHECK_CIRCLE_URL = `${BASE_URL}/email-icons/check-circle.png`;
export const RECEIPT_EXTERNAL_LINK_URL = `${BASE_URL}/email-icons/external-link.png`;
