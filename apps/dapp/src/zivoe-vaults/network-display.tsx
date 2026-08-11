import { type ComponentType } from 'react';

import { type CentrifugeNetwork, getShareClassNetworks } from '@zivoe/centrifuge-indexer';
import { EthereumIcon } from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

import { type ZivoeVault } from './zivoe-vault';

/** Network branding per Centrifuge network — a testnet advertises its mainnet family. */
const NETWORK_DISPLAY: Record<CentrifugeNetwork, { label: string; Icon: ComponentType<IconProps> }> = {
  mainnet: { label: 'Ethereum', Icon: EthereumIcon },
  sepolia: { label: 'Ethereum', Icon: EthereumIcon }
};

/**
 * Networks the Zivoe Vault's share class is live on per the catalog, deduped by
 * display family — the one derivation behind every "available networks"
 * surface (listing card chips, the Details row), so they can never disagree.
 */
export function zivoeVaultNetworkDisplays(zivoeVault: ZivoeVault) {
  const displays = getShareClassNetworks(zivoeVault.shareClass.key).map((network) => NETWORK_DISPLAY[network]);
  return [...new Map(displays.map((display) => [display.label, display])).values()];
}
