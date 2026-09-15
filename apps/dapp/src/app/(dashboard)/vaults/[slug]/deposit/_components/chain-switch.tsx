'use client';

import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useConnection, useSwitchChain } from 'wagmi';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Button } from '@zivoe/ui/core/button';
import { toast } from '@zivoe/ui/core/sonner';

import { getChainId } from '@/lib/chains';

import { useAccount } from '@/hooks/useAccount';

import { type TransactionIdentity } from '@/centrifuge';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { useZivoeVaultIdentities } from '../../zivoe-vault-provider';

// Module-private on purpose: useSelectedChain is the one reader and writer.
// The atom stores the RAW selection, persisted to localStorage so it survives
// a page refresh; validity is derived against the page's chains at read time,
// so a value left behind by another Zivoe Vault — or by a deploy that dropped
// a chain — falls back to the first chain unless it is live here too, with no
// reset lifecycle. Default getOnInit keeps SSR safe: server and first client
// render use the first chain, and the stored value syncs in on mount. The
// default storage also follows the browser's storage event, so open tabs
// share one live selection — intended: one user, one selection, the same way
// the wallet's own chain is shared across tabs.
const selectedChainAtom = atomWithStorage<CentrifugeChain | undefined>('zivoe.selected-chain', undefined);

/**
 * Each tab's chosen Centrifuge vault (lowercased address) per Zivoe Vault and
 * chain. Per tab because funding a deposit and being paid out are different
 * questions; per Zivoe Vault and chain so a choice never leaks to another
 * page or chain. Validated at read time: a vault no longer live falls back to
 * the chain's default. Nullable because a stored `null` parses fine and so
 * bypasses the storage's initial-value fallback.
 */
const selectedAssetAtoms = {
  deposit: atomWithStorage<Partial<Record<string, string>> | null>('zivoe.deposit-asset', {}),
  redeem: atomWithStorage<Partial<Record<string, string>> | null>('zivoe.redeem-asset', {})
};

function selectedAssetKey({ zivoeVaultSlug, chain }: { zivoeVaultSlug: string; chain: CentrifugeChain }): string {
  return `${zivoeVaultSlug}:${chain}`;
}

export type DepositTab = keyof typeof selectedAssetAtoms;

// Shared across every consumer of the switch mutation (the flows'
// selection-triggered prompt and SwitchChainButton are separate hook
// instances): one pending state means the button can never offer another
// prompt while any switch is already in flight. Counted, not boolean —
// prompts can overlap (the selector deliberately stays unlocked during a
// switch), and mutation callbacks fire per mutation, so an earlier prompt
// settling must not mark a still-open later prompt as done. Read only by
// SwitchChainButton — the flows write it without subscribing, so they do not
// re-render per prompt.
const pendingSwitchCountAtom = atom(0);

/**
 * The switch mutation and wallet gate. `isWalletOffChain` answers for any
 * chain (the Requests tab asks per chain group); `switchToChain` is only
 * written in event handlers.
 */
export function useChainSwitch() {
  const { address } = useAccount();
  const { chainId: walletChainId } = useConnection();
  const identities = useZivoeVaultIdentities();

  const setPendingSwitchCount = useSetAtom(pendingSwitchCountAtom);
  const { mutate: switchChainMutate } = useSwitchChain({
    mutation: {
      onMutate: () => setPendingSwitchCount((count) => count + 1),
      onSettled: () => setPendingSwitchCount((count) => count - 1),
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

  return { isWalletOffChain, switchToChain };
}

/** The page's identities grouped by chain, in deployment order; each chain's default vault first. */
export type ChainIdentities = {
  chain: CentrifugeChain;
  identities: [TransactionIdentity, ...Array<TransactionIdentity>];
};

export function groupIdentitiesByChain(
  identities: ReadonlyArray<TransactionIdentity>
): [ChainIdentities, ...Array<ChainIdentities>] {
  const groups: Array<ChainIdentities> = [];
  for (const identity of identities) {
    const group = groups.find((candidate) => candidate.chain === identity.centrifugeVault.chain);
    if (group) group.identities.push(identity);
    else groups.push({ chain: identity.centrifugeVault.chain, identities: [identity] });
  }
  const [first, ...rest] = groups;
  if (!first) throw new Error('A Zivoe Vault page needs at least one identity.');
  return [first, ...rest];
}

/**
 * The selected chain, its Centrifuge vaults, and its wallet gate. One shared
 * selection serves every consumer — both tabs (which unmount each other) and
 * the double-mounted EarnBox copies — so no two surfaces can disagree, and a
 * selection survives tab switches. Defaults to the first live chain, and the
 * chain's identities come from the same non-empty list the selection is
 * validated against, so a selected chain without an identity is
 * unrepresentable. With nothing stored, the wallet's connected chain wins
 * when it is live on this page (ground truth on a first visit), then the
 * first live chain. Selecting a chain the wallet is not on prompts the switch
 * immediately; the wallet-facing plumbing itself stays module-internal
 * (SwitchChainButton is the only other consumer), and a refused switch
 * surfaces as a toast rather than a silent no-op.
 *
 * Gating rule for BOTH flows' selectors: lock only on chain-agnostic state
 * (prerequisites still loading, a pending mutation) — never on per-chain or
 * per-vault verdicts (capacity, whitelist); those are exactly what switching
 * escapes.
 */
export function useSelectedChain() {
  const identities = useZivoeVaultIdentities();
  const { chainId: walletChainId } = useConnection();

  const chains = groupIdentitiesByChain(identities);

  const [storedChain, setStoredChain] = useAtom(selectedChainAtom);
  const selected =
    chains.find((group) => group.chain === storedChain) ??
    chains.find((group) => getChainId(group.chain) === walletChainId) ??
    chains[0];
  const selectedChain = selected.chain;

  const { isWalletOffChain, switchToChain } = useChainSwitch();

  const needsChainSwitch = isWalletOffChain(selectedChain);

  const setSelectedChain = (chain: CentrifugeChain) => {
    setStoredChain(chain);
    if (isWalletOffChain(chain)) switchToChain(chain);
  };

  return {
    identities,
    chains,
    selectedChain,
    /** The selected chain's Centrifuge vaults, default first. */
    chainIdentities: selected.identities,
    setSelectedChain,
    needsChainSwitch
  };
}

/**
 * The selected chain narrowed to the ONE Centrifuge vault a tab transacts
 * against: the shared chain selection plus the tab's own asset memory.
 * Selecting an identity selects its chain too.
 */
export function useSelectedIdentity({ tab }: { tab: DepositTab }) {
  const selection = useSelectedChain();
  const { selectedChain, chainIdentities, setSelectedChain } = selection;

  const [storedAssets, setStoredAssets] = useAtom(selectedAssetAtoms[tab]);
  // Every identity on the page carries the page's slug, so the chain's first suffices.
  const storedAsset =
    storedAssets?.[selectedAssetKey({ zivoeVaultSlug: chainIdentities[0].zivoeVaultSlug, chain: selectedChain })];
  const selectedIdentity =
    chainIdentities.find((identity) => identity.centrifugeVault.address.toLowerCase() === storedAsset) ??
    chainIdentities[0];

  const setSelectedIdentity = (identity: TransactionIdentity) => {
    const { chain, address } = identity.centrifugeVault;
    const key = selectedAssetKey({ zivoeVaultSlug: identity.zivoeVaultSlug, chain });
    setStoredAssets((stored) => ({ ...stored, [key]: address.toLowerCase() }));
    setSelectedChain(chain);
  };

  return { ...selection, selectedIdentity, setSelectedIdentity };
}

/** The one clear step an out-of-place wallet sees in place of every action. */
export function SwitchChainButton() {
  const { selectedChain } = useSelectedChain();
  const { switchToChain } = useChainSwitch();
  const isSwitchPending = useAtomValue(pendingSwitchCountAtom) > 0;

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
