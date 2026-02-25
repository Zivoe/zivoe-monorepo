import 'server-only';

import { LINKS } from '@/types/constants';

import { BASE_URL } from '../base-url';

export const RECEIPT_VIEW_IN_APP_URL = 'https://app.zivoe.com/';
export const RECEIPT_INQUIRIES_EMAIL = 'investors@zivoe.com';

export const RECEIPT_DISCLAIMER_TEXT =
  'This update is for informational purposes only. Past performance is not indicative of future results. Private credit investments involve risk, including loss of principal. Token valuations are based on Net Asset Value (NAV) methodology and may fluctuate based on market conditions.';

export const RECEIPT_COPYRIGHT_TEXT = '(c) Zivoe 2025. All Right Reserved.';

export const RECEIPT_QUICK_LINKS = [
  { label: 'Website', href: RECEIPT_VIEW_IN_APP_URL },
  { label: 'Terms', href: LINKS.TERMS_OF_USE },
  { label: 'Reg S Compliance', href: LINKS.REG_S_COMPLIANCE }
] as const;

// Token icon URLs (self-hosted PNGs in public/email-icons/)
const TOKEN_ICON_URL_BY_SYMBOL = {
  USDC: `${BASE_URL}/email-icons/usdc.png`,
  USDT: `${BASE_URL}/email-icons/usdt.png`,
  frxUSD: `${BASE_URL}/email-icons/frxusd.png`,
  zSTT: `${BASE_URL}/email-icons/zstt.png`,
  zVLT: `${BASE_URL}/email-icons/zvlt.png`
} as const;

export type ReceiptTokenSymbol = keyof typeof TOKEN_ICON_URL_BY_SYMBOL;

export function getReceiptTokenIconUrl(tokenSymbol: ReceiptTokenSymbol): string {
  return TOKEN_ICON_URL_BY_SYMBOL[tokenSymbol];
}

export const RECEIPT_ARROW_RIGHT_GRAY_URL = `${BASE_URL}/email-icons/arrow-right-gray.png`;
export const RECEIPT_ARROW_RIGHT_TEAL_URL = `${BASE_URL}/email-icons/arrow-right-teal.png`;
export const RECEIPT_CHECK_CIRCLE_URL = `${BASE_URL}/email-icons/check-circle.png`;
export const RECEIPT_EXTERNAL_LINK_URL = `${BASE_URL}/email-icons/external-link.png`;
