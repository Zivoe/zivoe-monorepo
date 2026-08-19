import { type ComponentType } from 'react';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { BaseIcon, EthereumIcon, MonadIcon } from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

import { zivoeVaultChains } from './availability';
import { type ZivoeVault } from './zivoe-vault';

/** Chain branding per spoke chain — a testnet chain advertises its mainnet family. */
export const CHAIN_DISPLAY: Record<CentrifugeChain, { label: string; Icon: ComponentType<IconProps> }> = {
  ethereum: { label: 'Ethereum', Icon: EthereumIcon },
  sepolia: { label: 'Ethereum', Icon: EthereumIcon },
  monad: { label: 'Monad', Icon: MonadIcon },
  'base-sepolia': { label: 'Base', Icon: BaseIcon }
};

/**
 * Chains the Zivoe Vault is live on IN THIS DEPLOYMENT (active chains whose
 * catalog entry and Centrifuge vault are both deployable), deduped by display
 * family — the one derivation behind every "available networks" surface
 * (listing card chips, the Details row), so they can never disagree.
 * Deployment-scoped on purpose: deriving from the whole catalog would
 * advertise chains this environment does not serve.
 */
export function zivoeVaultChainDisplays(zivoeVault: ZivoeVault) {
  const displays = zivoeVaultChains(zivoeVault).map((chain) => CHAIN_DISPLAY[chain]);
  return [...new Map(displays.map((display) => [display.label, display])).values()];
}
