'use client';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { useAccount } from '@/hooks/useAccount';
import { readState, useSettleWindow } from '@/hooks/useSettleWindow';

import {
  type RedemptionPosition,
  type TransactionIdentity,
  countRedemptionRequests,
  useRedemptionPositions
} from '@/centrifuge';

import { useZivoeVaultIdentities } from '../../zivoe-vault-provider';
import { groupIdentitiesByChain } from '../_components/chain-switch';

// The Pending tab's badge counts the same strips the Centrifuge module derives.
export { countRedemptionRequests };

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
 * are left out. `isPending` holds until every vault has answered or the settle
 * window has run out (see useSettleWindow): the tab shows one answer rather
 * than a list that grows chain by chain, while a dead RPC — which fails, and
 * so stops being pending — still cannot hide the other chains for a minute of
 * retries. `pendingChains` names the chains still on their first read, so a
 * surface can say what it has not counted yet.
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
  const { address } = useAccount();
  const positions = useRedemptionPositions({
    centrifugeVaults: identities.map((identity) => identity.centrifugeVault)
  });
  const resultOf = (identity: TransactionIdentity) => {
    const result = positions[identities.indexOf(identity)];
    return result && readState(result);
  };

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
  // Reads only start once the wallet is known, so the window does too.
  const isHolding = useSettleWindow({ isPending: address !== undefined && pendingChains.length > 0 });

  return {
    chains,
    count: chains.reduce((sum, group) => sum + group.count, 0),
    isPending: isHolding,
    pendingChains,
    isEveryReadFailed: positions.length > 0 && positions.every((result) => readState(result).isError),
    refetch: () => positions.forEach((result) => void result.refetch())
  };
}
