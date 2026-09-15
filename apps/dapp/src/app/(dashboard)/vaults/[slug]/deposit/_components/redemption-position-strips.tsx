'use client';

import { Button } from '@zivoe/ui/core/button';

import { formatBigIntWithCommas } from '@/lib/utils';

import { OTHER_WRITE_PENDING_LABEL, useIsAnyTxPending } from '@/hooks/useIsAnyTxPending';

import ConnectedAccount from '@/components/connected-account';

import {
  type InvestorAccess,
  type TransactedCentrifugeVault,
  type TransactionIdentity,
  sharesToDepositAsset,
  useCancelRedeem,
  useClaimRedeem,
  useClaimReturnedShares,
  useRedemptionPosition
} from '@/centrifuge';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

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
 * request (or its Cancellation Processing). Centrifuge keys positions per
 * vault — so per deposit asset — and the SDK's cancel and claim act on one
 * vault, which is why this is rendered once per vault of the selected chain
 * rather than once per chain. Positions are data-driven: a request or a
 * cancellation made outside this dApp still resolves here.
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
  /** Name the vault's stablecoin on each strip — set when the chain has several vaults, so two "processing" strips cannot be confused. */
  labelAsset: boolean;
  gates: RedeemAccessGates;
  sharePrice: bigint | undefined;
  /** Chain-level block on every write: prerequisites still loading. */
  isWriteBlocked: boolean;
  /**
   * Present while the wallet sits on another chain: every action on these
   * strips executes on the vault's chain, so each control offers the switch
   * instead — the Requests tab lists several chains at once, and a greyed
   * Claim would say nothing about why.
   */
  switchChain?: { label: string; onPress: () => void };
  onSuccessClose: () => void;
}) {
  const { centrifugeVault } = identity;
  const { asset, shareClass: share, chain } = centrifugeVault;
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

  // Every write shares one wallet and one transaction path, so each control
  // waits out every other — in this vault's strips, the other vaults' strips,
  // and the forms on the other tabs; the lifecycle keeps the count across tab
  // switches. Pass the control's own pending flag — its own run is already
  // shown (and blocked) by the button's `isPending`.
  const isAnyWritePending = useIsAnyTxPending();
  const isOtherMutationPending = (isSelfPending: boolean) => isAnyWritePending && !isSelfPending;

  // A post-transaction refetch of THIS vault's position keeps its controls
  // locked until fresh data lands — the same rule the form applies to its own
  // prerequisites. Cancellation Processing polls, so it does not count.
  const isBlocked = isWriteBlocked || (position.isFetching && !isCancellationProcessing);

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

  // Only where the chain has several vaults: names which stablecoin's request
  // a share-denominated strip belongs to. The asset strips already say it.
  const assetLabel = labelAsset ? (
    <p className="text-extraSmall font-medium tracking-wide text-tertiary uppercase">{asset.symbol} redemption</p>
  ) : null;

  return (
    <>
      {returnedShares > 0n && (
        <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
          {assetLabel}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-regular text-primary">
              {formatBigIntWithCommas({ value: returnedShares, tokenDecimals: share.decimals, displayDecimals: 2 })}{' '}
              {share.symbol} returned from cancellation
            </p>

            <ConnectedAccount fullWidth={false} type="skeleton">
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
          </div>

          {isShareReturnBlocked && <p className="text-extraSmall text-tertiary">{shareReturnHint}</p>}
        </div>
      )}

      {claimableAssets > 0n && (
        <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
          {assetLabel}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* A blocked wallet's headline cannot say ready: the amount is
                approved, the claim is not — the hint below says why. */}
            <p className="text-regular text-primary">
              {formatBigIntWithCommas({ value: claimableAssets, tokenDecimals: asset.decimals, displayDecimals: 2 })}{' '}
              {asset.symbol} {isProceedsClaimBlocked ? 'approved' : 'ready to claim'}
            </p>

            <ConnectedAccount fullWidth={false} type="skeleton">
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
          </div>

          {/* The block wins over the turn-taking hint: "claim your returned
              shares first" is no help to a wallet that cannot claim them. */}
          {isProceedsClaimBlocked ? (
            <p className="text-extraSmall text-tertiary">{proceedsClaimHint}</p>
          ) : returnedShares > 0n ? (
            <p className="text-extraSmall text-tertiary">
              {isShareReturnBlocked ? shareReturnHint : `Claim your returned ${share.symbol} first.`}
            </p>
          ) : null}
        </div>
      )}

      {unfundedAssets > 0n && (
        <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
          {assetLabel}
          <p className="text-regular text-primary">
            {formatBigIntWithCommas({ value: unfundedAssets, tokenDecimals: asset.decimals, displayDecimals: 2 })}{' '}
            {asset.symbol} approved, awaiting liquidity on {CHAIN_DISPLAY[chain].label}
          </p>

          {/* Two things stand between a frozen wallet and its proceeds; name
              both. An unexplained refusal adds nothing to a strip that already
              says nobody can claim yet. */}
          {isProceedsClaimBlocked && restriction === 'frozen' && (
            <p className="text-extraSmall text-tertiary">{proceedsClaimHint}</p>
          )}
        </div>
      )}

      {isCancellationProcessing ? (
        <CancellationProcessingStrip
          pendingShares={pendingShares}
          centrifugeVault={centrifugeVault}
          assetLabel={assetLabel}
        />
      ) : (
        pendingShares > 0n && (
          <RedemptionProcessingStrip
            pendingShares={pendingShares}
            sharePrice={sharePrice}
            centrifugeVault={centrifugeVault}
            assetLabel={assetLabel}
            cancel={
              supportsCancel
                ? {
                    onPress: handleCancelRedeem,
                    isDisabled: isBlocked || isShareReturnBlocked || isOtherMutationPending(cancelRedeem.isPending),
                    blockedHint: isShareReturnBlocked ? shareReturnHint : undefined,
                    isPending: cancelRedeem.isPending,
                    isTxPending: cancelRedeem.isTxPending,
                    isOtherWritePending: isOtherMutationPending(cancelRedeem.isPending),
                    switchChain
                  }
                : undefined
            }
          />
        )
      )}
    </>
  );
}

/** The one step an out-of-place wallet sees in place of a strip's action. */
function SwitchButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button variant="border-light" size="s" onPress={onPress}>
      {label}
    </Button>
  );
}

function RedemptionProcessingStrip({
  pendingShares,
  sharePrice,
  centrifugeVault,
  assetLabel,
  cancel
}: {
  pendingShares: bigint;
  sharePrice: bigint | undefined;
  centrifugeVault: TransactedCentrifugeVault;
  assetLabel: React.ReactNode;
  /** Absent on chains without redeem cancellation — the strip is then read-only. */
  cancel?: {
    onPress: () => void;
    isDisabled: boolean;
    /** Present when the wallet is what blocks the control — narrows the generic disabled state to the one cause worth naming. */
    blockedHint?: string;
    isPending: boolean;
    isTxPending: boolean;
    /** A write started elsewhere is in flight — the control waits it out and says so. */
    isOtherWritePending: boolean;
    switchChain?: { label: string; onPress: () => void };
  };
}) {
  const { asset, shareClass } = centrifugeVault;
  const pendingAssets = sharePrice
    ? sharesToDepositAsset({ shares: pendingShares, sharePrice, shareClass, asset })
    : undefined;

  return (
    <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
      {assetLabel}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-regular text-primary">
          {formatBigIntWithCommas({ value: pendingShares, tokenDecimals: shareClass.decimals, displayDecimals: 2 })}{' '}
          {shareClass.symbol} processing
          {pendingAssets !== undefined
            ? ` · ≈ ${formatBigIntWithCommas({ value: pendingAssets, tokenDecimals: asset.decimals, displayDecimals: 2 })} ${asset.symbol}`
            : ''}
        </p>

        {cancel && (
          <ConnectedAccount fullWidth={false} type="skeleton">
            {cancel.switchChain ? (
              <SwitchButton {...cancel.switchChain} />
            ) : (
              <Button
                variant="link-neutral-light"
                size="s"
                onPress={cancel.onPress}
                isDisabled={cancel.isDisabled}
                isPending={cancel.isPending || cancel.isOtherWritePending}
                pendingContent={
                  cancel.isTxPending
                    ? 'Cancelling...'
                    : cancel.isPending
                      ? 'Signing Transaction...'
                      : cancel.isOtherWritePending
                        ? OTHER_WRITE_PENDING_LABEL
                        : undefined
                }
              >
                Cancel request
              </Button>
            )}
          </ConnectedAccount>
        )}
      </div>

      {cancel?.blockedHint && <p className="text-extraSmall text-tertiary">{cancel.blockedHint}</p>}
    </div>
  );
}

function CancellationProcessingStrip({
  pendingShares,
  centrifugeVault,
  assetLabel
}: {
  pendingShares: bigint;
  centrifugeVault: TransactedCentrifugeVault;
  assetLabel: React.ReactNode;
}) {
  const { asset, shareClass } = centrifugeVault;
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
      {assetLabel}
      <p className="text-regular text-primary">
        Cancelling redemption request
        {pendingShares > 0n
          ? ` for ${formatBigIntWithCommas({ value: pendingShares, tokenDecimals: shareClass.decimals, displayDecimals: 2 })} ${shareClass.symbol}`
          : ''}
      </p>

      <p className="text-extraSmall text-tertiary">
        Your {shareClass.symbol} will be available to claim once the cancellation is processed. Any portion already
        approved still executes as {asset.symbol}.
      </p>
    </div>
  );
}
