import { CHAIN_DISPLAY } from '@zivoe/ui/components/chain-display';

import { formatBigIntWithCommas } from '@/lib/utils';

import { sharesToDepositAsset } from './config';
import { type RedemptionPosition, type TransactedCentrifugeVault } from './types';

/**
 * The states one Redemption Position can be in at once, each the fact
 * behind one strip of the Pending tab and one row of the portfolio's
 * Redemptions card — derived here so the two surfaces can never disagree
 * on what a wallet has in flight. Order is the Pending tab's strip order.
 * A partial fill legitimately yields several states for one vault.
 */
export type RedemptionState =
  /** Returned Shares: a cancellation finished and the shares wait for the claim that restores the wallet balance. */
  | { kind: 'returned'; shares: bigint }
  /** Proceeds ready to claim: settled and funded on this chain. */
  | { kind: 'claimable'; assets: bigint }
  /** Unfunded Claim: settled, but this chain's escrow cannot pay it yet. */
  | { kind: 'unfunded'; assets: bigint }
  /** Cancellation Processing: the request is locked until Centrifuge finishes the unwind. */
  | { kind: 'cancelling'; shares: bigint }
  /** Redemption Processing: shares in escrow, waiting for the manager's approval. */
  | { kind: 'processing'; shares: bigint };

export function redemptionStates(position: RedemptionPosition | undefined): Array<RedemptionState> {
  if (!position) return [];
  const states: Array<RedemptionState> = [];
  if (position.claimableCancelRedeemShares > 0n)
    states.push({ kind: 'returned', shares: position.claimableCancelRedeemShares });
  if (position.claimableRedeemAssets > 0n) states.push({ kind: 'claimable', assets: position.claimableRedeemAssets });
  if (position.unfundedClaimableAssets > 0n)
    states.push({ kind: 'unfunded', assets: position.unfundedClaimableAssets });
  if (position.hasPendingCancelRedeemRequest) states.push({ kind: 'cancelling', shares: position.pendingRedeemShares });
  else if (position.pendingRedeemShares > 0n) states.push({ kind: 'processing', shares: position.pendingRedeemShares });
  return states;
}

/** How many strips a position renders — the Pending tab's badge and the portfolio's count both count these. */
export function countRedemptionRequests(position: RedemptionPosition | undefined): number {
  return redemptionStates(position).length;
}

/**
 * The one-line reading of a state, as the Pending tab's strips print it;
 * the portfolio reuses it verbatim. Amounts carry two decimals like every
 * other amount in the app. The share price, when known, adds the pending
 * request's indicative value in the vault's deposit asset.
 */
export function describeRedemptionState({
  state,
  centrifugeVault,
  sharePrice
}: {
  state: RedemptionState;
  centrifugeVault: TransactedCentrifugeVault;
  sharePrice?: bigint;
}): string {
  const { asset, shareClass, chain } = centrifugeVault;
  const shares = (value: bigint) =>
    `${formatBigIntWithCommas({ value, tokenDecimals: shareClass.decimals, displayDecimals: 2 })} ${shareClass.symbol}`;
  const assets = (value: bigint) =>
    `${formatBigIntWithCommas({ value, tokenDecimals: asset.decimals, displayDecimals: 2 })} ${asset.symbol}`;

  switch (state.kind) {
    case 'returned':
      return `${shares(state.shares)} returned from cancellation`;
    case 'claimable':
      return `${assets(state.assets)} ready to claim`;
    case 'unfunded':
      return `${assets(state.assets)} approved, awaiting liquidity on ${CHAIN_DISPLAY[chain].label}`;
    case 'cancelling':
      return state.shares > 0n
        ? `Cancelling redemption request for ${shares(state.shares)}`
        : 'Cancelling redemption request';
    case 'processing': {
      const pendingAssets =
        sharePrice === undefined
          ? undefined
          : sharesToDepositAsset({ shares: state.shares, sharePrice, shareClass, asset });
      return `${shares(state.shares)} processing${pendingAssets === undefined ? '' : ` · ≈ ${assets(pendingAssets)}`}`;
    }
  }
}

/**
 * The same state as a ledger row: the amount in flight, the one or two
 * words naming where it stands, and what else the row should say. The
 * portfolio's Redemptions card prints this where the Pending tab prints
 * the sentence; both come from the one `RedemptionState`, so they name the
 * same facts in two registers. `inMotion` marks the states still changing
 * on their own (the row's status pulses); the others wait on the investor.
 * `isClaimBlocked` is the Pending tab's access verdict: a wallet that may
 * not claim reads its proceeds as approved, never as ready.
 */
export type RedemptionSummary = {
  amount: string;
  status: string;
  detail: string | undefined;
  inMotion: boolean;
};

export function summarizeRedemptionState({
  state,
  centrifugeVault,
  sharePrice,
  isClaimBlocked = false
}: {
  state: RedemptionState;
  centrifugeVault: TransactedCentrifugeVault;
  sharePrice?: bigint;
  isClaimBlocked?: boolean;
}): RedemptionSummary {
  const { asset, shareClass } = centrifugeVault;
  const shares = (value: bigint) =>
    `${formatBigIntWithCommas({ value, tokenDecimals: shareClass.decimals, displayDecimals: 2 })} ${shareClass.symbol}`;
  const assets = (value: bigint) =>
    `${formatBigIntWithCommas({ value, tokenDecimals: asset.decimals, displayDecimals: 2 })} ${asset.symbol}`;

  switch (state.kind) {
    case 'returned':
      return { amount: shares(state.shares), status: 'Returned', detail: 'From a cancelled request', inMotion: false };
    case 'claimable':
      return {
        amount: assets(state.assets),
        status: isClaimBlocked ? 'Approved' : 'Ready to claim',
        detail: undefined,
        inMotion: false
      };
    case 'unfunded':
      return {
        amount: assets(state.assets),
        status: 'Awaiting liquidity',
        detail: 'Approved, not yet funded on this network',
        inMotion: true
      };
    case 'cancelling':
      return {
        amount: state.shares > 0n ? shares(state.shares) : 'Redemption request',
        status: 'Cancelling',
        detail: `${shareClass.symbol} returns once the cancellation is processed`,
        inMotion: true
      };
    case 'processing': {
      const pendingAssets =
        sharePrice === undefined
          ? undefined
          : sharesToDepositAsset({ shares: state.shares, sharePrice, shareClass, asset });
      return {
        amount: shares(state.shares),
        status: 'Processing',
        detail: pendingAssets === undefined ? 'Awaiting approval' : `≈ ${assets(pendingAssets)} on approval`,
        inMotion: true
      };
    }
  }
}
