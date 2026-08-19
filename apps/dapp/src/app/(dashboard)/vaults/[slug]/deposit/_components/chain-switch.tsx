'use client';

import { atom, useAtom } from 'jotai';
import { useConnection, useSwitchChain } from 'wagmi';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Button } from '@zivoe/ui/core/button';
import { toast } from '@zivoe/ui/core/sonner';

import { getChainId } from '@/lib/network';

import { useAccount } from '@/hooks/useAccount';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/network-display';

import { useZivoeVaultIdentities } from '../../zivoe-vault-provider';

// Module-private on purpose: useSelectedChain is the one reader and writer.
// The atom stores the RAW selection; validity is derived against the page's
// chains at read time, so a value left behind by another Zivoe Vault falls
// back to the first chain unless it is live here too — no reset lifecycle.
const selectedChainAtom = atom<CentrifugeChain | undefined>(undefined);

/**
 * The selected chain, its resolved identity, and its wallet gate. One shared
 * selection serves every consumer — both tabs (which unmount each other) and
 * the double-mounted EarnBox copies — so no two surfaces can disagree, and a
 * selection survives tab switches. Defaults to the first live chain, and the
 * identity comes from the same non-empty list the selection is validated
 * against, so a selected chain without an identity is unrepresentable. The
 * switch mutation lives here too, so the selection-triggered prompt and the
 * CTA share one pending state instead of double-prompting the wallet, and a
 * refused switch surfaces as a toast rather than a silent no-op.
 */
export function useSelectedChain() {
  const identities = useZivoeVaultIdentities();
  const chains = identities.map((identity) => identity.shareClass.chain);

  const [storedChain, setStoredChain] = useAtom(selectedChainAtom);
  const selectedIdentity = identities.find((identity) => identity.shareClass.chain === storedChain) ?? identities[0];
  const selectedChain = selectedIdentity.shareClass.chain;

  const { address } = useAccount();
  const { chainId: walletChainId } = useConnection();
  const { mutate: switchChainMutate, isPending: isSwitchPending } = useSwitchChain({
    mutation: {
      onError: (_error, { chainId }) => {
        const chain = chains.find((candidate) => getChainId(candidate) === chainId);
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

  const needsChainSwitch = isWalletOffChain(selectedChain);

  const switchToChain = (chain: CentrifugeChain) => switchChainMutate({ chainId: getChainId(chain) });

  const setSelectedChain = (chain: CentrifugeChain) => {
    setStoredChain(chain);
    if (isWalletOffChain(chain)) switchToChain(chain);
  };

  return {
    identities,
    chains,
    selectedIdentity,
    selectedChain,
    setSelectedChain,
    needsChainSwitch,
    switchToChain,
    isSwitchPending
  };
}

/** The one clear step an out-of-place wallet sees in place of every action. */
export function SwitchChainButton({
  chain,
  onSwitch,
  isPending
}: {
  chain: CentrifugeChain;
  onSwitch: () => void;
  isPending: boolean;
}) {
  return (
    <Button fullWidth onPress={onSwitch} isPending={isPending} pendingContent="Switching Network...">
      Switch to {CHAIN_DISPLAY[chain].label}
    </Button>
  );
}
