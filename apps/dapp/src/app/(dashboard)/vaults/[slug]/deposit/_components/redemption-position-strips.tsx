'use client';

import { Button } from '@zivoe/ui/core/button';
import { NextLink } from '@zivoe/ui/core/link';

import { OTHER_WRITE_PENDING_LABEL, useIsAnyTxPending } from '@/hooks/useIsAnyTxPending';

import ConnectedAccount from '@/components/connected-account';
import { RedemptionItem } from '@/components/redemption-item';

import {
  type InvestorAccess,
  type TransactionIdentity,
  useCancelRedeem,
  useClaimRedeem,
  useClaimReturnedShares,
  useRedemptionPosition
} from '@/centrifuge';

import { useIsKycEnabled } from '../../kyc-flag-provider';

/**
 * The redeem tab's reading of the wallet's access verdicts — three gates,
 * because the Centrifuge vault's verdicts do not fall along the panel's own
 * lines. Only a definitive `false` gates anything: a failed read is a fetch
 * problem and not a verdict, so it leaves them alone and lets the pre-sign
 * simulation decode the real revert if the Centrifuge vault does refuse.
 * Derived once in the flow and handed to every vault's strips: the verdicts
 * are share-token facts, identical for every Centrifuge vault on the chain.
 */
export type RedeemAccessGates = {
  /** The request gate — may this wallet send shares to escrow. */
  isNotAdmitted: boolean;
  /** Cancelling and claiming returned shares both reduce on-chain to "may this wallet receive shares", so they stand or fall together. */
  isShareReturnBlocked: boolean;
  /**
   * Claiming settled proceeds is exempt from the memberlist (a wallet that is
   * no longer whitelisted keeps proceeds it is already owed) but not from a
   * freeze, so it carries its own verdict rather than either of the above.
   */
  isProceedsClaimBlocked: boolean;
  /** Names the block; never widens it. An unread or unexplained reason falls back to the general "not whitelisted" presentation. */
  restriction: InvestorAccess['restriction'] | undefined;
  /** The strips' buttons are too narrow to carry the reason and sit far from the tab's callout, so they get their own short form of the same answer. */
  shareReturnHint: string;
  /** Membership never blocks a claim, so an unexplained refusal here cannot be named "not whitelisted" the way the share controls' fallback is. */
  proceedsClaimHint: string;
};

export function deriveRedeemAccessGates(access: {
  isSuccess: boolean;
  data: InvestorAccess | undefined;
}): RedeemAccessGates {
  const restriction = access.data?.restriction;
  return {
    isNotAdmitted: access.isSuccess && access.data?.canRequestRedemption === false,
    isShareReturnBlocked: access.isSuccess && access.data?.canReceiveShares === false,
    isProceedsClaimBlocked: access.isSuccess && access.data?.canClaimProceeds === false,
    restriction,
    shareReturnHint: restriction === 'frozen' ? 'This wallet is frozen.' : 'Requires a whitelisted wallet.',
    proceedsClaimHint: restriction === 'frozen' ? 'This wallet is frozen.' : 'This wallet cannot claim right now.'
  };
}

/**
 * One Centrifuge vault's Redemption Position and the writes that act on it:
 * Returned Shares, claimable proceeds, an Unfunded Claim, and the pending
 * request (or its Cancellation Processing). Rendered once per vault, not per
 * chain: Centrifuge keys positions per vault, and the SDK's cancel and claim
 * act on one. Data-driven, so a request made outside this dApp resolves here.
 * Each strip is the shared `RedemptionItem` (the portfolio prints the same
 * ones) with this tab's control on the right and its hints underneath.
 */
export function RedemptionPositionStrips({
  identity,
  labelAsset,
  gates,
  sharePrice,
  isWriteBlocked,
  switchChain,
  onSuccessClose
}: {
  identity: TransactionIdentity;
  /** Names the vault's stablecoin on each strip; set where the chain has several vaults. */
  labelAsset: boolean;
  gates: RedeemAccessGates;
  sharePrice: bigint | undefined;
  /** Chain-level block on every write: prerequisites still loading. */
  isWriteBlocked: boolean;
  /** Present while the wallet sits on another chain; each control then offers the switch instead of its action. */
  switchChain?: { label: string; onPress: () => void };
  onSuccessClose: () => void;
}) {
  const { centrifugeVault } = identity;
  const { asset, shareClass: share } = centrifugeVault;
  // Chains without the hub-side unwind get no cancel control at all — the
  // claims and the Cancellation Processing strip stay data-driven.
  const supportsCancel = centrifugeVault.supportsRedeemCancellation;
  const { isShareReturnBlocked, isProceedsClaimBlocked, restriction, shareReturnHint, proceedsClaimHint } = gates;

  const position = useRedemptionPosition({ centrifugeVault });
  const claimRedeem = useClaimRedeem({ identity, onSuccessClose });
  const cancelRedeem = useCancelRedeem({ identity, onSuccessClose });
  const claimReturnedShares = useClaimReturnedShares({ identity, onSuccessClose });

  const pendingShares = position.data?.pendingRedeemShares ?? 0n;
  const claimableAssets = position.data?.claimableRedeemAssets ?? 0n;
  // Unfunded Claim: settled, but this chain's escrow cannot pay it yet. Nothing
  // the investor does resolves it, so its strip carries no action at all — just
  // the amount and the chain — until a later position read sees it funded.
  const unfundedAssets = position.data?.unfundedClaimableAssets ?? 0n;
  const returnedShares = position.data?.claimableCancelRedeemShares ?? 0n;
  const isCancellationProcessing = position.data?.hasPendingCancelRedeemRequest ?? false;

  // Every control waits out a write started anywhere else (see useIsAnyTxPending).
  // Pass the control's own pending flag: its own run is already shown by `isPending`.
  const isAnyWritePending = useIsAnyTxPending();
  const isOtherMutationPending = (isSelfPending: boolean) => isAnyWritePending && !isSelfPending;

  // A wallet that held a position and is no longer whitelisted was most likely
  // removed on purpose — a revoked verification is the usual reason — so the
  // hint leads to the page that shows the investor's exact status. A freeze
  // is support's to review, so its hint stays as it is — as does every hint
  // while the `kyc` flag is off.
  const isKycEnabled = useIsKycEnabled();
  const shareReturnBlockedHint =
    restriction === 'frozen' || !isKycEnabled ? (
      shareReturnHint
    ) : (
      <>
        {shareReturnHint}{' '}
        <NextLink href="/verification" className="underline underline-offset-4 hover:no-underline">
          Check your verification
        </NextLink>
      </>
    );

  // A post-transaction refetch of this vault's position locks its controls
  // until fresh data lands.
  const isBlocked = isWriteBlocked || position.isFetching;

  const handleClaim = () => {
    if (claimableAssets <= 0n || isProceedsClaimBlocked) return;
    claimRedeem.mutate({ claimableAssets });
  };

  const handleCancelRedeem = () => {
    if (pendingShares <= 0n || isShareReturnBlocked || !supportsCancel) return;
    cancelRedeem.mutate({ pendingShares });
  };

  const handleClaimReturnedShares = () => {
    if (returnedShares <= 0n || isShareReturnBlocked) return;
    claimReturnedShares.mutate({ returnedShares });
  };

  const item = { centrifugeVault, labelAsset, className: ITEM_CLASSES };

  return (
    <>
      {returnedShares > 0n && (
        <RedemptionItem
          {...item}
          state={{ kind: 'returned', shares: returnedShares }}
          action={
            <ConnectedAccount fullWidth={false} type="skeleton" connectSkeletonClassName="h-8 w-28">
              {switchChain ? (
                <SwitchButton {...switchChain} />
              ) : (
                <Button
                  onPress={handleClaimReturnedShares}
                  size="s"
                  isDisabled={
                    isBlocked || isShareReturnBlocked || isOtherMutationPending(claimReturnedShares.isPending)
                  }
                  isPending={claimReturnedShares.isPending || isOtherMutationPending(claimReturnedShares.isPending)}
                  pendingContent={
                    claimReturnedShares.isTxPending
                      ? `Claiming ${share.symbol}...`
                      : claimReturnedShares.isPending
                        ? 'Signing Transaction...'
                        : isOtherMutationPending(claimReturnedShares.isPending)
                          ? OTHER_WRITE_PENDING_LABEL
                          : undefined
                  }
                >
                  Claim {share.symbol}
                </Button>
              )}
            </ConnectedAccount>
          }
        >
          {isShareReturnBlocked && <p>{shareReturnBlockedHint}</p>}
        </RedemptionItem>
      )}

      {claimableAssets > 0n && (
        // A blocked wallet's pill cannot say ready: the amount is approved, the claim is not; the hint below says why.
        <RedemptionItem
          {...item}
          state={{ kind: 'claimable', assets: claimableAssets }}
          isClaimBlocked={isProceedsClaimBlocked}
          action={
            <ConnectedAccount fullWidth={false} type="skeleton" connectSkeletonClassName="h-8 w-28">
              {switchChain ? (
                <SwitchButton {...switchChain} />
              ) : (
                <Button
                  onPress={handleClaim}
                  size="s"
                  isDisabled={
                    isBlocked ||
                    isProceedsClaimBlocked ||
                    isOtherMutationPending(claimRedeem.isPending) ||
                    // The SDK's aggregate claim empties Returned Shares before the
                    // proceeds in one shared transaction path, so the proceeds
                    // claim waits its turn. The protocol itself would pay them on
                    // its own (the router's claimRedeem), so a wallet that can no
                    // longer receive shares waits here until re-admitted — an SDK
                    // limitation we accept; revisit if the SDK ever exposes the
                    // proceeds claim alone.
                    returnedShares > 0n
                  }
                  isPending={claimRedeem.isPending || isOtherMutationPending(claimRedeem.isPending)}
                  pendingContent={
                    claimRedeem.isTxPending
                      ? `Claiming ${asset.symbol}...`
                      : claimRedeem.isPending
                        ? 'Signing Transaction...'
                        : isOtherMutationPending(claimRedeem.isPending)
                          ? OTHER_WRITE_PENDING_LABEL
                          : undefined
                  }
                >
                  Claim {asset.symbol}
                </Button>
              )}
            </ConnectedAccount>
          }
        >
          {/* The block wins over the turn-taking hint: "claim your returned
              shares first" is no help to a wallet that cannot claim them. */}
          {isProceedsClaimBlocked ? (
            <p>{proceedsClaimHint}</p>
          ) : returnedShares > 0n ? (
            <p>{isShareReturnBlocked ? shareReturnBlockedHint : `Claim your returned ${share.symbol} first.`}</p>
          ) : null}
        </RedemptionItem>
      )}

      {unfundedAssets > 0n && (
        <RedemptionItem {...item} state={{ kind: 'unfunded', assets: unfundedAssets }}>
          {/* Two things stand between a frozen wallet and its proceeds; name
              both. An unexplained refusal adds nothing to a strip that already
              says nobody can claim yet. */}
          {isProceedsClaimBlocked && restriction === 'frozen' && <p>{proceedsClaimHint}</p>}
        </RedemptionItem>
      )}

      {isCancellationProcessing ? (
        <RedemptionItem {...item} state={{ kind: 'cancelling', shares: pendingShares }}>
          <p>
            Your {share.symbol} will be available to claim once the cancellation is processed. Any portion already
            approved still executes as {asset.symbol}.
          </p>
        </RedemptionItem>
      ) : (
        pendingShares > 0n && (
          <RedemptionItem
            {...item}
            state={{ kind: 'processing', shares: pendingShares }}
            sharePrice={sharePrice}
            action={
              // Chains without the hub-side unwind get no cancel control at all.
              supportsCancel && (
                <ConnectedAccount fullWidth={false} type="skeleton" connectSkeletonClassName="h-5 w-24">
                  {switchChain ? (
                    <SwitchButton {...switchChain} />
                  ) : (
                    <Button
                      variant="link-neutral-light"
                      size="s"
                      onPress={handleCancelRedeem}
                      isDisabled={isBlocked || isShareReturnBlocked || isOtherMutationPending(cancelRedeem.isPending)}
                      isPending={cancelRedeem.isPending || isOtherMutationPending(cancelRedeem.isPending)}
                      pendingContent={
                        cancelRedeem.isTxPending
                          ? 'Cancelling...'
                          : cancelRedeem.isPending
                            ? 'Signing Transaction...'
                            : isOtherMutationPending(cancelRedeem.isPending)
                              ? OTHER_WRITE_PENDING_LABEL
                              : undefined
                      }
                    >
                      Cancel request
                    </Button>
                  )}
                </ConnectedAccount>
              )
            }
          >
            {/* Present when the wallet is what blocks the control — narrows the generic disabled state to the one cause worth naming. */}
            {supportsCancel && isShareReturnBlocked && <p>{shareReturnBlockedHint}</p>}
          </RedemptionItem>
        )
      )}
    </>
  );
}

/** Items stack inside the chain group's box, divided by hairlines (see pending-flow). */
const ITEM_CLASSES = 'border-b border-subtle last:border-b-0';

/** The one step an out-of-place wallet sees in place of a strip's action. */
function SwitchButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button variant="border-light" size="s" onPress={onPress}>
      {label}
    </Button>
  );
}
