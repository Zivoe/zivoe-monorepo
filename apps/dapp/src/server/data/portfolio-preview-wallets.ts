import 'server-only';

import { type Address } from 'viem';

import { env } from '@/env';

/**
 * Investor wallets the team reviews the portfolio page against, read-only.
 * Server-only on purpose: the page hands the list to the client only when
 * the switcher is enabled, so the addresses never ship in a production
 * bundle. The switch is a local/Preview environment variable and is
 * refused outright on Production, whatever the variable says.
 */
const PORTFOLIO_PREVIEW_WALLETS: Array<Address> = [
  '0xb8DA328A4edB64af841C6bb72b55988e9abeB172',
  '0xcf43d6670800f8eda45451bf1a5cf57162199543',
  '0x5611ab9a1be761187df7d0377beb4c45a1f69296',
  '0xe350c554ba695037e4040a60e8844a44c6c3a406',
  '0xa76c3662daf3e250e5ff61efe14351c5221049b2',
  '0xda8907993c37cfd742fa308d23b2811cf72545f3',
  '0xfa071893e752e2400caa33ce14df48c8ac10c035'
];

export function getPortfolioPreviewWallets(): Array<Address> {
  if (env.VERCEL_ENV === 'production' || env.PORTFOLIO_PREVIEW_WALLETS_ENABLED !== 'true') return [];
  return PORTFOLIO_PREVIEW_WALLETS;
}
