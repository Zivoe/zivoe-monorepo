'use client';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { type RedemptionPosition, type TransactionIdentity, useRedemptionPositions } from '@/centrifuge';

import { useZivoeVaultIdentities } from '../../zivoe-vault-provider';
import { groupIdentitiesByChain } from '../_components/chain-switch';

/** How many strips a position renders — the Pending tab's badge counts these. */
export function countRedemptionRequests(position: RedemptionPosition | undefined): number {
  if (!position) return 0;
  return (
    (position.claimableCancelRedeemShares > 0n ? 1 : 0) +
    (position.claimableRedeemAssets > 0n ? 1 : 0) +
    (position.unfundedClaimableAssets > 0n ? 1 : 0) +
    (position.pendingRedeemShares > 0n || position.hasPendingCancelRedeemRequest ? 1 : 0)
  );
}

export type RedemptionRequestEntry = {
  identity: TransactionIdentity;
  /** Undefined while unread or failed. */
  position: RedemptionPosition | undefined;
  isError: boolean;
};

export type RedemptionRequestsByChain = {
  chain: CentrifugeChain;
  /** The chain's Centrifuge vaults in catalog order, default first. */
  entries: [RedemptionRequestEntry, ...Array<RedemptionRequestEntry>];
  count: number;
};

/**
 * The wallet's Redemption Positions across every Centrifuge vault of the page,
 * grouped by chain in deployment order. Chains holding nothing for the wallet
 * are left out. `isPending` holds only until the first vault answers: one
 * dead RPC would otherwise hide every other chain's answer (and the empty
 * state) for a minute of retries. `pendingChains` names the chains still on
 * their first read, so a surface can say what it has not counted yet.
 */
export function useRedemptionRequests(): {
  chains: Array<RedemptionRequestsByChain>;
  count: number;
  isPending: boolean;
  pendingChains: Array<CentrifugeChain>;
  /** True when no vault answered and every read failed — one outage, not ten. */
  isEveryReadFailed: boolean;
  refetch: () => void;
} {
  const identities = useZivoeVaultIdentities();
  const positions = useRedemptionPositions({
    centrifugeVaults: identities.map((identity) => identity.centrifugeVault)
  });
  const resultOf = (identity: TransactionIdentity) => positions[identities.indexOf(identity)];

  const groups = groupIdentitiesByChain(identities);
  const chains = groups.flatMap(({ chain, identities: [firstIdentity, ...restIdentities] }) => {
    const toEntry = (identity: TransactionIdentity): RedemptionRequestEntry => {
      const result = resultOf(identity);
      return { identity, position: result?.data, isError: result?.isError ?? false };
    };
    const entries: RedemptionRequestsByChain['entries'] = [toEntry(firstIdentity), ...restIdentities.map(toEntry)];
    const count = entries.reduce((sum, entry) => sum + countRedemptionRequests(entry.position), 0);
    return count > 0 || entries.some((entry) => entry.isError) ? [{ chain, entries, count }] : [];
  });
  const pendingChains = groups
    .filter(({ identities: chainIdentities }) => chainIdentities.some((identity) => resultOf(identity)?.isPending))
    .map(({ chain }) => chain);

  return {
    chains,
    count: chains.reduce((sum, group) => sum + group.count, 0),
    isPending: positions.every((result) => result.isPending),
    pendingChains,
    isEveryReadFailed: positions.length > 0 && positions.every((result) => result.isError),
    refetch: () => positions.forEach((result) => void result.refetch())
  };
}
