import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { type ChainDisplay, CHAIN_DISPLAY as UI_CHAIN_DISPLAY } from '@zivoe/ui/components/chain-display';

import { zivoeVaultChains } from './availability';
import { type ZivoeVault } from './zivoe-vault';

// The design-system map, asserted complete for this deployment's chain union:
// a chain added to the indexer without an entry in @zivoe/ui fails here.
// Re-exported so the dApp's many consumers keep one import path.
export const CHAIN_DISPLAY: Record<CentrifugeChain, ChainDisplay> = UI_CHAIN_DISPLAY;

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
