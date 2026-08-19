'use client';

import { atom, useAtom } from 'jotai';
import { useConnection, useSwitchChain } from 'wagmi';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Button } from '@zivoe/ui/core/button';
import { toast } from '@zivoe/ui/core/sonner';

import { getChainId } from '@/lib/chains';

import { useAccount } from '@/hooks/useAccount';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { useZivoeVaultIdentities } from '../../zivoe-vault-provider';

// Module-private on purpose: useSelectedChain is the one reader and writer.
// The atom stores the RAW selection; validity is derived against the page's
// chains at read time, so a value left behind by another Zivoe Vault falls
// back to the first chain unless it is live here too — no reset lifecycle.
const selectedChainAtom = atom<CentrifugeChain | undefined>(undefined);

// Shared across every consumer of the switch mutation (the flows'
// selection-triggered prompt and SwitchChainButton are separate hook
// instances): one pending state means the button can never offer a second
// prompt while any switch is already in flight.
const isSwitchPendingAtom = atom(false);

/** The switch mutation and wallet gate — module-private; only written in event handlers. */
function useChainSwitch() {
  const { address } = useAccount();
  const { chainId: walletChainId } = useConnection();
  const identities = useZivoeVaultIdentities();

  const [isSwitchPending, setIsSwitchPending] = useAtom(isSwitchPendingAtom);
  const { mutate: switchChainMutate } = useSwitchChain({
    mutation: {
      onMutate: () => setIsSwitchPending(true),
      onSettled: () => setIsSwitchPending(false),
      onError: (_error, { chainId }) => {
        const chain = identities
          .map((identity) => identity.centrifugeVault.chain)
          .find((candidate) => getChainId(candidate) === chainId);
        toast({
          type: 'error',
          title: `Could not switch to ${chain ? CHAIN_DISPLAY[chain].label : 'the selected network'}`
        });
      }
    }
  });

  // `undefined` while wagmi reconnects means "unknown", not a mismatch —
  // gating on it would flash the switch CTA at a wallet already on the
  // right chain.
  const isWalletOffChain = (chain: CentrifugeChain) =>
    Boolean(address) && walletChainId !== undefined && walletChainId !== getChainId(chain);

  const switchToChain = (chain: CentrifugeChain) => switchChainMutate({ chainId: getChainId(chain) });

  return { isWalletOffChain, switchToChain, isSwitchPending };
}

/**
 * The selected chain, its resolved identity, and its wallet gate. One shared
 * selection serves every consumer — both tabs (which unmount each other) and
 * the double-mounted EarnBox copies — so no two surfaces can disagree, and a
 * selection survives tab switches. Defaults to the first live chain, and the
 * identity comes from the same non-empty list the selection is validated
 * against, so a selected chain without an identity is unrepresentable.
 * Selecting a chain the wallet is not on prompts the switch immediately; the
 * wallet-facing plumbing itself stays module-internal (SwitchChainButton is
 * the only other consumer), and a refused switch surfaces as a toast rather
 * than a silent no-op.
 *
 * Gating rule for BOTH flows' chain selectors: lock only on chain-agnostic
 * state (prerequisites still loading, a pending mutation) — never on
 * per-chain verdicts (capacity, whitelist); those are exactly what switching
 * chains escapes.
 */
export function useSelectedChain() {
  const identities = useZivoeVaultIdentities();

  const [storedChain, setStoredChain] = useAtom(selectedChainAtom);
  const selectedIdentity =
    identities.find((identity) => identity.centrifugeVault.chain === storedChain) ?? identities[0];
  const selectedChain = selectedIdentity.centrifugeVault.chain;

  const { isWalletOffChain, switchToChain } = useChainSwitch();

  const needsChainSwitch = isWalletOffChain(selectedChain);

  const setSelectedChain = (chain: CentrifugeChain) => {
    setStoredChain(chain);
    if (isWalletOffChain(chain)) switchToChain(chain);
  };

  return {
    identities,
    selectedIdentity,
    selectedChain,
    setSelectedChain,
    needsChainSwitch
  };
}

/** The one clear step an out-of-place wallet sees in place of every action. */
export function SwitchChainButton() {
  const { selectedChain } = useSelectedChain();
  const { switchToChain, isSwitchPending } = useChainSwitch();

  return (
    <Button
      fullWidth
      onPress={() => switchToChain(selectedChain)}
      isPending={isSwitchPending}
      pendingContent="Switching Network..."
    >
      Switch to {CHAIN_DISPLAY[selectedChain].label}
    </Button>
  );
}
