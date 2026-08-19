'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Input } from '@zivoe/ui/core/input';
import { Skeleton } from '@zivoe/ui/core/skeleton';

import { formatBigIntWithCommas } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useBalance } from '@/hooks/useBalance';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useCurrentShareMetrics } from '@/hooks/useCurrentShareMetrics';

import ConnectedAccount from '@/components/connected-account';
import { getTokenInfo } from '@/components/token-info';

import {
  type TransactedCentrifugeVault,
  sharesToUsdc,
  sharesToValueD18,
  useCancelRedeem,
  useClaimRedeem,
  useClaimReturnedShares,
  useInvestorWhitelist,
  useRedemptionPosition,
  useRequestRedeem
} from '@/centrifuge';

import { ChainBalanceDetail } from './_components/chain-balance-detail';
import { SwitchChainButton, useSelectedChain } from './_components/chain-switch';
import { ChainTokenSelector } from './_components/chain-token-selector';
import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { NotWhitelistedCallout } from './_components/not-whitelisted-callout';
import { TokenDisplay } from './_components/token-display';
import { useEarnDialog } from './_hooks/earn-dialog';
import { createAmountValidator, parseInput } from './_utils';

type RedeemForm = { redeem: string };

export default function RedeemFlow() {
  const {
    identities,
    selectedIdentity: identity,
    selectedChain,
    setSelectedChain,
    needsChainSwitch
  } = useSelectedChain();

  const { centrifugeVault } = identity;
  const share = centrifugeVault.shareClass;
  const usdc = centrifugeVault.usdc;
  // Chains without the hub-side unwind get no cancel control at all — the
  // claims and the Cancellation Processing strip stay data-driven, so a
  // cancellation made outside this dApp still resolves here.
  const supportsCancel = centrifugeVault.supportsRedeemCancellation;

  const account = useAccount();
  const chainalysis = useChainalysis();
  const { setIsOpen: setIsEarnDialogOpen } = useEarnDialog();

  const shareBalance = useBalance({ chain: selectedChain, tokenAddress: share.shareTokenAddress });
  const usdcBalance = useBalance({ chain: selectedChain, tokenAddress: usdc.address });
  const position = useRedemptionPosition({ centrifugeVault });
  const metrics = useCurrentShareMetrics({ shareClassKey: share.key });
  const whitelist = useInvestorWhitelist({ centrifugeVault });

  // Two gates, because the whitelist does not fall along this panel's own
  // lines. Only a definitive `false` gates anything: a failed read is a fetch
  // problem and not a verdict, so it leaves both alone and lets the pre-sign
  // simulation decode the real revert if the Centrifuge vault does refuse.
  //
  // Claiming settled USDC is deliberately under neither: the protocol exempts
  // a redeem claim from the whitelist (and USDC carries no transfer hook), so
  // a wallet that is no longer whitelisted keeps proceeds it is already owed.
  const isNotWhitelisted = whitelist.isSuccess && !whitelist.data.canRequestRedemption;
  // Cancelling and claiming returned shares both reduce on-chain to "may this
  // wallet receive shares", so they stand or fall together.
  const isShareReturnBlocked = whitelist.isSuccess && !whitelist.data.canReceiveShares;

  const sharePrice = metrics.data ? BigInt(metrics.data.sharePriceD18) : undefined;
  const pendingShares = position.data?.pendingRedeemShares ?? 0n;
  const claimableAssets = position.data?.claimableRedeemAssets ?? 0n;
  const returnedShares = position.data?.claimableCancelRedeemShares ?? 0n;
  const isCancellationProcessing = position.data?.hasPendingCancelRedeemRequest ?? false;
  const hasPosition = pendingShares > 0n || claimableAssets > 0n;

  const form = useForm<RedeemForm>({
    resolver: zodResolver(
      z.object({
        redeem: createAmountValidator({
          balance: shareBalance.data ?? 0n,
          decimals: share.decimals,
          requiredMessage: 'Redeem amount is required',
          exceedsMessage: 'Redeem amount exceeds balance'
        })
      })
    ),
    defaultValues: { redeem: undefined },
    mode: 'onChange'
  });

  const redeem = form.watch('redeem');
  const redeemRaw = redeem ? parseUnits(redeem, share.decimals) : undefined;
  const hasRedeemRaw = redeemRaw !== undefined && redeemRaw > 0n;

  const estimatedAssets =
    hasRedeemRaw && sharePrice ? sharesToUsdc({ shares: redeemRaw, sharePrice, shareClass: share }) : undefined;
  const redeemDollarValue =
    redeemRaw !== undefined && sharePrice
      ? sharesToValueD18({ shares: redeemRaw, sharePrice, shareClass: share })
      : redeem
        ? null
        : 0n;

  const requestRedeem = useRequestRedeem({ identity, onSuccessClose: () => setIsEarnDialogOpen(false) });
  const claimRedeem = useClaimRedeem({ identity, onSuccessClose: () => setIsEarnDialogOpen(false) });
  const cancelRedeem = useCancelRedeem({ identity, onSuccessClose: () => setIsEarnDialogOpen(false) });
  const claimReturnedShares = useClaimReturnedShares({ identity, onSuccessClose: () => setIsEarnDialogOpen(false) });

  // Balances/position use isFetching so post-transaction invalidations keep
  // the form locked until fresh data lands. Cancellation Processing polls the
  // position, so it deliberately does NOT feed isPrereqsLoading — only the
  // initial load and post-transaction refetches do.
  const isPrereqsLoading =
    account.isPending ||
    shareBalance.isFetching ||
    usdcBalance.isFetching ||
    chainalysis.isFetching ||
    whitelist.isFetching ||
    (position.isFetching && !isCancellationProcessing) ||
    // isPending on purpose: metrics refetch on a 5-minute interval, and
    // isFetching would flash the whole form to loading on every refresh.
    metrics.isPending;

  const isMutationPending =
    requestRedeem.isPending || claimRedeem.isPending || cancelRedeem.isPending || claimReturnedShares.isPending;
  // Every write on this tab (request, cancel, both claims) executes on the
  // selected chain, so one gate serves them all: the strips' buttons disable
  // and the main action becomes the switch.
  const isWriteBlocked = isPrereqsLoading || needsChainSwitch;
  /**
   * All four writes share one transaction path, so each control waits out the
   * other three. Pass the control's own pending flag — its own run is already
   * shown (and blocked) by the button's `isPending`.
   */
  const isOtherMutationPending = (isSelfPending: boolean) => isMutationPending && !isSelfPending;
  // Cancellation Processing locks the whole form: a new request would revert
  // on-chain until the hub finishes the unwind. A wallet the Centrifuge vault
  // will not admit locks it for the same reason — there is no amount worth entering.
  // Only the request gate applies here: a wallet that may still send shares to
  // escrow can use this form even when its share moves back are blocked.
  const isFormLocked = isPrereqsLoading || isMutationPending || isCancellationProcessing || isNotWhitelisted;

  // Chain-agnostic locks only — the rule lives on useSelectedChain's doc.
  // Named like the deposit tab's carrier so the two selectors cannot drift.
  const isChainSelectorLocked = isPrereqsLoading || isMutationPending;

  // Named once, like the deposit tab's, so the button and its handler cannot
  // drift apart. Only a sibling write gates the action; the settled facts above
  // are enforced one level up, where the ladder swaps this button for a named
  // one — repeating them here would describe states this gate never sees.
  const isSubmitBlocked = isOtherMutationPending(requestRedeem.isPending);

  // Both states are presentation only, and both are scoped to an entered amount
  // to match the deposit tab. The estimate quotes a price that will not be the
  // settlement price anyway — the callout below the row says as much — so it
  // never gates the request; it only decides what the Estimated receive row
  // shows. A retry in flight shows loading rather than the stale error, and a
  // fetched Share Price of 0 (pre-first-price row or upstream glitch) counts as
  // failed, so the row resolves instead of skeletoning forever.
  const isEstimateFailed =
    hasRedeemRaw && (metrics.isError || (!metrics.isPending && !sharePrice)) && !metrics.isFetching;
  const isEstimateLoading = hasRedeemRaw && !isEstimateFailed && estimatedAssets === undefined;

  const validateForm = () => form.trigger('redeem', { shouldFocus: true });

  const handleRequestRedeem = async () => {
    const isValid = await validateForm();
    if (!isValid || isSubmitBlocked) return;
    // Narrowing only — validation guarantees redeemRaw. estimatedAssets is
    // deliberately not required: it rides along for the receipt.
    if (!redeemRaw) return;

    requestRedeem.mutate(
      { shares: redeemRaw, estimatedAssets },
      // A reverted receipt also resolves as mutation success (it routes to the
      // failure dialog) — keep the entered amount so the user can retry as-is.
      { onSuccess: ({ receipt }) => receipt.status === 'success' && form.reset({ redeem: undefined }) }
    );
  };

  // Balance verdicts are wallet- and chain-scoped — see the deposit tab.
  useEffect(() => {
    if (account.address) form.clearErrors();
  }, [account.address, selectedChain, form]);

  const handleClaim = () => {
    if (claimableAssets <= 0n) return;

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

  // Display entry for the share token; the fixture classes tests hand in have
  // none, so the selector falls back to the bare symbol without an icon.
  const shareSelectorToken = getTokenInfo(share.symbol) ?? { label: share.symbol, icon: null };

  const receiveValue = estimatedAssets !== undefined ? formatUnits(estimatedAssets, usdc.decimals) : '';
  // Suppress the amount input's `0.0` ghost while the estimate is loading —
  // it would otherwise read as "you receive 0.0" next to the skeleton.
  const receivePlaceholder = isEstimateLoading ? '' : undefined;
  const receiveDollarValue = isEstimateFailed ? 0n : (estimatedAssets ?? (redeem ? null : 0n));

  return (
    <>
      {returnedShares > 0n && (
        <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-regular text-primary">
              {formatBigIntWithCommas({ value: returnedShares, tokenDecimals: share.decimals, displayDecimals: 2 })}{' '}
              {share.symbol} returned from cancellation
            </p>

            <ConnectedAccount fullWidth={false} type="skeleton">
              <Button
                onPress={handleClaimReturnedShares}
                size="s"
                isDisabled={
                  isWriteBlocked || isShareReturnBlocked || isOtherMutationPending(claimReturnedShares.isPending)
                }
                isPending={claimReturnedShares.isPending}
                pendingContent={
                  claimReturnedShares.isTxPending
                    ? `Claiming ${share.symbol}...`
                    : claimReturnedShares.isPending
                      ? 'Signing Transaction...'
                      : undefined
                }
              >
                Claim {share.symbol}
              </Button>
            </ConnectedAccount>
          </div>

          {/* The button is too narrow to carry the reason, and the callout at
              the foot of the panel is a long way from this control. */}
          {isShareReturnBlocked && <p className="text-extraSmall text-tertiary">Requires a whitelisted wallet.</p>}
        </div>
      )}

      {claimableAssets > 0n && (
        <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-regular text-primary">
              {formatBigIntWithCommas({ value: claimableAssets, tokenDecimals: usdc.decimals, displayDecimals: 2 })}{' '}
              USDC ready to claim
            </p>

            <ConnectedAccount fullWidth={false} type="skeleton">
              <Button
                onPress={handleClaim}
                size="s"
                isDisabled={
                  isWriteBlocked ||
                  isOtherMutationPending(claimRedeem.isPending) ||
                  // The Centrifuge vault claims Returned Shares before USDC in one
                  // shared transaction path, so the USDC claim waits its turn.
                  returnedShares > 0n
                }
                isPending={claimRedeem.isPending}
                pendingContent={
                  claimRedeem.isTxPending
                    ? 'Claiming USDC...'
                    : claimRedeem.isPending
                      ? 'Signing Transaction...'
                      : undefined
                }
              >
                Claim USDC
              </Button>
            </ConnectedAccount>
          </div>

          {returnedShares > 0n && (
            <p className="text-extraSmall text-tertiary">Claim your returned {share.symbol} first.</p>
          )}
        </div>
      )}

      {isCancellationProcessing ? (
        <CancellationProcessingStrip pendingShares={pendingShares} centrifugeVault={centrifugeVault} />
      ) : (
        pendingShares > 0n && (
          <RedemptionProcessingStrip
            pendingShares={pendingShares}
            sharePrice={sharePrice}
            centrifugeVault={centrifugeVault}
            cancel={
              supportsCancel
                ? {
                    onPress: handleCancelRedeem,
                    isDisabled:
                      isWriteBlocked || isShareReturnBlocked || isOtherMutationPending(cancelRedeem.isPending),
                    isBlockedByWhitelist: isShareReturnBlocked,
                    isPending: cancelRedeem.isPending,
                    isTxPending: cancelRedeem.isTxPending
                  }
                : undefined
            }
          />
        )
      )}

      <Controller
        control={form.control}
        name="redeem"
        render={({ field: { value, onChange, ...field }, fieldState: { error, invalid } }) => (
          <Input
            {...field}
            inputMode="decimal"
            variant="amount"
            label="Redeem"
            value={value ?? ''}
            onChange={(value) => onChange(parseInput(value) || undefined)}
            errorMessage={error?.message}
            isInvalid={invalid}
            isDisabled={isFormLocked}
            decimalPlaces={share.decimals}
            subContent={
              <InputExtraInfo
                // sharesToValueD18 is 18-decimal whatever the share token's own
                // decimals are; the balance carries the token's scale itself.
                dollarValueDecimals={18}
                dollarValue={redeemDollarValue}
                balance={{ value: shareBalance.data, isPending: shareBalance.isPending, decimals: share.decimals }}
              />
            }
            endContent={
              <div className="flex items-center">
                <MaxButton
                  balance={shareBalance.data ?? 0n}
                  decimals={share.decimals}
                  onPress={(value) => onChange(value)}
                  isDisabled={isFormLocked}
                />

                <div className="ml-3">
                  <ChainTokenSelector
                    title="Select Asset"
                    token={shareSelectorToken}
                    // Each row shows that chain's redeemable share balance —
                    // the position the user came here to redeem, and the one
                    // signal that tells them which chain actually holds it.
                    rows={identities.map((rowIdentity) => ({
                      chain: rowIdentity.centrifugeVault.chain,
                      detail: <ChainBalanceDetail identity={rowIdentity} token="share" />
                    }))}
                    selectedChain={selectedChain}
                    onSelect={setSelectedChain}
                    isDisabled={isChainSelectorLocked}
                  />
                </div>
              </div>
            }
          />
        )}
      />

      <Input
        variant="amount"
        label="Estimated receive"
        value={receiveValue}
        placeholder={receivePlaceholder}
        isDisabled
        hasNormalStyleIfDisabled={!isFormLocked}
        errorMessage={
          isEstimateFailed ? (
            <>
              Unable to estimate USDC.{' '}
              <Button variant="link-alert" size="s" onPress={() => void metrics.refetch()}>
                Retry
              </Button>
            </>
          ) : undefined
        }
        isInvalid={isEstimateFailed}
        startContent={isEstimateLoading ? <Skeleton className="h-6 w-24" /> : undefined}
        subContent={
          <InputExtraInfo
            dollarValueDecimals={usdc.decimals}
            dollarValue={receiveDollarValue}
            isLoading={isEstimateLoading}
            balance={{ value: usdcBalance.data, isPending: usdcBalance.isPending, decimals: usdc.decimals }}
          />
        }
        endContent={<TokenDisplay symbol="USDC" />}
      />

      <ConnectedAccount>
        {needsChainSwitch ? (
          <SwitchChainButton />
        ) : isPrereqsLoading ? (
          <Button fullWidth isPending={true} pendingContent="Loading..." />
        ) : isCancellationProcessing ? (
          <Button fullWidth isDisabled>
            Cancellation in progress
          </Button>
        ) : isNotWhitelisted ? (
          <Button fullWidth isDisabled>
            Wallet Not Whitelisted
          </Button>
        ) : (
          <Button
            fullWidth
            onPress={() => void handleRequestRedeem()}
            isDisabled={isSubmitBlocked}
            isPending={requestRedeem.isPending}
            pendingContent={
              requestRedeem.isTxPending
                ? 'Requesting redemption...'
                : requestRedeem.isPending
                  ? 'Signing Transaction...'
                  : undefined
            }
          >
            {hasPosition ? 'Add to redemption' : 'Request redemption'}
          </Button>
        )}
      </ConnectedAccount>

      <div className="flex flex-col gap-1.5">
        <Callout variant="warning">
          Redemptions are processed periodically. Your final USDC amount is determined using the Token Price when your
          request is processed.
        </Callout>

        {/* Why the action above is disabled — the verdict only exists once a
            wallet is connected. */}
        {isNotWhitelisted && <NotWhitelistedCallout />}
      </div>
    </>
  );
}

function RedemptionProcessingStrip({
  pendingShares,
  sharePrice,
  centrifugeVault,
  cancel
}: {
  pendingShares: bigint;
  sharePrice: bigint | undefined;
  centrifugeVault: TransactedCentrifugeVault;
  /** Absent on chains without redeem cancellation — the strip is then read-only. */
  cancel?: {
    onPress: () => void;
    isDisabled: boolean;
    /** Narrows the generic disabled state to the one cause worth naming here. */
    isBlockedByWhitelist: boolean;
    isPending: boolean;
    isTxPending: boolean;
  };
}) {
  const { usdc, shareClass } = centrifugeVault;
  const pendingUsdc = sharePrice ? sharesToUsdc({ shares: pendingShares, sharePrice, shareClass }) : undefined;

  return (
    <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-regular text-primary">
          {formatBigIntWithCommas({ value: pendingShares, tokenDecimals: shareClass.decimals, displayDecimals: 2 })}{' '}
          {shareClass.symbol} processing
          {pendingUsdc !== undefined
            ? ` · ≈ ${formatBigIntWithCommas({ value: pendingUsdc, tokenDecimals: usdc.decimals, displayDecimals: 2 })} USDC`
            : ''}
        </p>

        {cancel && (
          <ConnectedAccount fullWidth={false} type="skeleton">
            <Button
              variant="link-neutral-light"
              size="s"
              onPress={cancel.onPress}
              isDisabled={cancel.isDisabled}
              isPending={cancel.isPending}
              pendingContent={
                cancel.isTxPending ? 'Cancelling...' : cancel.isPending ? 'Signing Transaction...' : undefined
              }
            >
              Cancel request
            </Button>
          </ConnectedAccount>
        )}
      </div>

      {/* The button is too narrow to carry the reason, and the callout at the
          foot of the panel is a long way from this control. */}
      {cancel?.isBlockedByWhitelist && <p className="text-extraSmall text-tertiary">Requires a whitelisted wallet.</p>}
    </div>
  );
}

function CancellationProcessingStrip({
  pendingShares,
  centrifugeVault
}: {
  pendingShares: bigint;
  centrifugeVault: TransactedCentrifugeVault;
}) {
  const { shareClass } = centrifugeVault;
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
      <p className="text-regular text-primary">
        Cancelling redemption request
        {pendingShares > 0n
          ? ` for ${formatBigIntWithCommas({ value: pendingShares, tokenDecimals: shareClass.decimals, displayDecimals: 2 })} ${shareClass.symbol}`
          : ''}
      </p>

      <p className="text-extraSmall text-tertiary">
        Your {shareClass.symbol} will be available to claim once the cancellation is processed. Any portion already
        approved still executes as USDC.
      </p>
    </div>
  );
}
