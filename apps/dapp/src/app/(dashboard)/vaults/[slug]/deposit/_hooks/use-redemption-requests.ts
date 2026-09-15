'use client';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { type RedemptionPosition, type TransactionIdentity, useRedemptionPositions } from '@/centrifuge';

import { useZivoeVaultIdentities } from '../../zivoe-vault-provider';
import { groupIdentitiesByChain } from '../_components/chain-switch';

/** How many strips a position renders — the Requests tab's badge counts these. */
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
 * are left out; `isPending` holds until every vault has answered once.
 */
export function useRedemptionRequests(): {
  chains: Array<RedemptionRequestsByChain>;
  count: number;
  isPending: boolean;
} {
  const identities = useZivoeVaultIdentities();
  const positions = useRedemptionPositions({
    centrifugeVaults: identities.map((identity) => identity.centrifugeVault)
  });

  const chains = groupIdentitiesByChain(identities).flatMap(
    ({ chain, identities: [firstIdentity, ...restIdentities] }) => {
      const toEntry = (identity: TransactionIdentity): RedemptionRequestEntry => {
        const result = positions[identities.indexOf(identity)];
        return { identity, position: result?.data, isError: result?.isError ?? false };
      };
      const entries: RedemptionRequestsByChain['entries'] = [toEntry(firstIdentity), ...restIdentities.map(toEntry)];
      const count = entries.reduce((sum, entry) => sum + countRedemptionRequests(entry.position), 0);
      return count > 0 || entries.some((entry) => entry.isError) ? [{ chain, entries, count }] : [];
    }
  );

  return {
    chains,
    count: chains.reduce((sum, group) => sum + group.count, 0),
    isPending: positions.some((result) => result.isPending)
  };
}
