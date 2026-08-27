import { type ComponentType } from 'react';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { BaseIcon, EthereumIcon, PharosIcon } from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

import { zivoeVaultChains } from './availability';
import { type ZivoeVault } from './zivoe-vault';

/** Chain branding per spoke chain — a testnet chain advertises its mainnet family. */
export const CHAIN_DISPLAY: Record<CentrifugeChain, { label: string; Icon: ComponentType<IconProps> }> = {
  ethereum: { label: 'Ethereum', Icon: EthereumIcon },
  sepolia: { label: 'Ethereum', Icon: EthereumIcon },
  pharos: { label: 'Pharos', Icon: PharosIcon },
  base: { label: 'Base', Icon: BaseIcon },
  'base-sepolia': { label: 'Base', Icon: BaseIcon }
};

/**
 * Chains the Zivoe Vault is live on IN THIS DEPLOYMENT (the catalog's live
 * chains on the active environment), deduped by display
 * family — the one derivation behind every "available networks" surface
 * (listing card chips, the Details row), so they can never disagree.
 * Deployment-scoped on purpose: deriving from the whole catalog would
 * advertise chains this environment does not serve.
 */
export function zivoeVaultChainDisplays(zivoeVault: ZivoeVault) {
  const displays = zivoeVaultChains(zivoeVault).map((chain) => CHAIN_DISPLAY[chain]);
  return [...new Map(displays.map((display) => [display.label, display])).values()];
}
