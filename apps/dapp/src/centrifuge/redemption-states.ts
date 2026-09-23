import { type RedemptionPosition } from './types';

export type RedemptionState = {
  kind: 'processing' | 'cancelling' | 'returned' | 'claimable' | 'unfunded';
  label: string;
  amount: bigint;
  denomination: 'shares' | 'asset';
};

/** Current protocol states, not submission counts. A partial fill can have several states. */
export function redemptionStates(position: RedemptionPosition | undefined): Array<RedemptionState> {
  if (!position) return [];
  const states: Array<RedemptionState> = [];
  if (position.claimableCancelRedeemShares > 0n)
    states.push({
      kind: 'returned',
      label: 'Returned shares awaiting claim',
      amount: position.claimableCancelRedeemShares,
      denomination: 'shares'
    });
  if (position.claimableRedeemAssets > 0n)
    states.push({
      kind: 'claimable',
      label: 'Proceeds ready to claim',
      amount: position.claimableRedeemAssets,
      denomination: 'asset'
    });
  if (position.unfundedClaimableAssets > 0n)
    states.push({
      kind: 'unfunded',
      label: 'Approved, awaiting liquidity',
      amount: position.unfundedClaimableAssets,
      denomination: 'asset'
    });
  if (position.hasPendingCancelRedeemRequest || position.pendingRedeemShares > 0n)
    states.push({
      kind: position.hasPendingCancelRedeemRequest ? 'cancelling' : 'processing',
      label: position.hasPendingCancelRedeemRequest ? 'Cancellation processing' : 'Redemption processing',
      amount: position.pendingRedeemShares,
      denomination: 'shares'
    });
  return states;
}

export function countRedemptionRequests(position: RedemptionPosition | undefined): number {
  return redemptionStates(position).length;
}
