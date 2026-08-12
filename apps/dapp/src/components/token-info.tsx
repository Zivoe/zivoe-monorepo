import { SHARE_CLASS_CATALOG } from '@zivoe/centrifuge-indexer';
import { UsdcIcon } from '@zivoe/ui/icons';

import { type DepositToken, type ShareToken } from '@/types/constants';

import { ZIVOE_VAULTS } from '@/zivoe-vaults';

type TokenInfo = { label: string; description: string; icon: React.ReactNode };

const DEPOSIT_TOKEN_INFO: Record<DepositToken, TokenInfo> = {
  USDC: {
    label: 'USDC',
    description: 'US Dollar Coin',
    icon: <UsdcIcon />
  }
};

// One display entry per registered share token, keyed by the CATALOG's symbol
// — the same source payload snapshots carry, so a lookup cannot miss. Partial
// on purpose: ZIVOE_VAULTS is filtered to the active network, so a catalogued
// class not live here has no entry — share-symbol lookups must stay null-safe
// (getTokenInfo) rather than assume catalog-wide completeness.
const SHARE_TOKEN_INFO: Partial<Record<ShareToken, TokenInfo>> = Object.fromEntries(
  ZIVOE_VAULTS.map((zivoeVault) => {
    const symbol = SHARE_CLASS_CATALOG[zivoeVault.shareClass.key].symbol;
    return [symbol, { label: symbol, description: zivoeVault.shareTokenDescription, icon: <zivoeVault.Logo /> }];
  })
);

export const TOKEN_INFO: Record<DepositToken, TokenInfo> & Partial<Record<ShareToken, TokenInfo>> = {
  ...DEPOSIT_TOKEN_INFO,
  ...SHARE_TOKEN_INFO
};

// Fresh literal so the union-keyed record widens to string keys.
const TOKEN_INFO_BY_SYMBOL: Record<string, TokenInfo | undefined> = { ...TOKEN_INFO };

/**
 * Display info looked up by a runtime symbol — for surfaces rendering a
 * transaction payload's token snapshot, where the symbol is a plain string.
 * Undefined for symbols no registered Zivoe Vault carries.
 */
export function getTokenInfo(symbol: string): TokenInfo | undefined {
  // Object.hasOwn: the symbol is an arbitrary runtime string, and a
  // prototype-chain key like "toString" would otherwise return a function.
  return Object.hasOwn(TOKEN_INFO_BY_SYMBOL, symbol) ? TOKEN_INFO_BY_SYMBOL[symbol] : undefined;
}
