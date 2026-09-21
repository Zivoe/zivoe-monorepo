import { CHAIN_DISPLAY } from '@zivoe/ui/components/chain-display';

import { zivoeVaultChains } from './availability';
import { type ZivoeVault } from './zivoe-vault';

// Re-exported so the dApp's many consumers keep one import path; the map
// itself lives in @zivoe/ui because the landing renders the same chips.
export { CHAIN_DISPLAY };

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
