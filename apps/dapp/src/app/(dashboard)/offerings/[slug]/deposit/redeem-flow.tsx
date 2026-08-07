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

import {
  CENTRIFUGE_ENV,
  type TransactedShareClass,
  sharesToUsdc,
  sharesToValueD18,
  useCancelRedeem,
  useClaimRedeem,
  useClaimReturnedShares,
  useInvestorAllowlist,
  useRedemptionPosition,
  useRequestRedeem
} from '@/centrifuge';

import { useOfferingIdentity } from '../offering-provider';
import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { NotAllowlistedCallout } from './_components/not-allowlisted-callout';
import { TokenDisplay } from './_components/token-display';
import { useEarnDialog } from './_hooks/earn-dialog';
import { createAmountValidator, parseInput } from './_utils';

// The one deposit asset every Offering accepts — a network-level fact.
const USDC = CENTRIFUGE_ENV.usdc;

type RedeemForm = { redeem: string };

export default function RedeemFlow() {
  const identity = useOfferingIdentity();
  const share = identity.shareClass;

  const account = useAccount();
  const chainalysis = useChainalysis();
  const { setIsOpen: setIsEarnDialogOpen } = useEarnDialog();

  const shareBalance = useBalance({ tokenAddress: share.shareTokenAddress });
  const usdcBalance = useBalance({ tokenAddress: USDC.address });
  const position = useRedemptionPosition({ shareClass: share });
  const metrics = useCurrentShareMetrics({ shareClassKey: share.key });
  const allowlist = useInvestorAllowlist({ shareClass: share });

  // Two gates, because the allow list does not fall along this panel's own
  // lines. Only a definitive `false` gates anything: a failed read is a fetch
  // problem and not a verdict, so it leaves both alone and lets the pre-sign
  // simulation decode the real revert if the vault does refuse.
  //
  // Claiming settled USDC is deliberately under neither: the protocol exempts
  // a redeem claim from the memberlist (and USDC carries no transfer hook), so
  // a de-listed wallet keeps proceeds it is already owed.
  const isNotAllowlisted = allowlist.isSuccess && !allowlist.data.canRequestRedemption;
  // Cancelling and claiming returned shares both reduce on-chain to "may this
  // wallet receive shares", so they stand or fall together.
  const isShareReturnBlocked = allowlist.isSuccess && !allowlist.data.canReceiveShares;

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
    allowlist.isFetching ||
    (position.isFetching && !isCancellationProcessing) ||
    // isPending on purpose: metrics refetch on a 5-minute interval, and
    // isFetching would flash the whole form to loading on every refresh.
    metrics.isPending;

  const isMutationPending =
    requestRedeem.isPending || claimRedeem.isPending || cancelRedeem.isPending || claimReturnedShares.isPending;
  // Cancellation Processing locks the whole form: a new request would revert
  // on-chain until the hub finishes the unwind. A wallet the vault will not
  // admit locks it for the same reason — there is no amount worth entering.
  // Only the request gate applies here: a wallet that may still send shares to
  // escrow can use this form even when its share moves back are blocked.
  const isFormLocked = isPrereqsLoading || isMutationPending || isCancellationProcessing || isNotAllowlisted;

  // Both states are presentation only. The estimate quotes a price that will
  // not be the settlement price anyway — the callout below the row says as
  // much — so it never gates the request; it only decides what the Estimated
  // receive row shows. A retry in flight shows loading rather than the stale
  // error, and a fetched Share Price of 0 (pre-first-price row or upstream
  // glitch) counts as failed, so the row resolves instead of skeletoning
  // forever.
  // Both are scoped to an entered amount, matching the deposit tab: there is no
  // estimate to fail until there is something to estimate, and a red row on an
  // untouched form reads as a problem with the form.
  const isEstimateFailed =
    hasRedeemRaw && (metrics.isError || (!metrics.isPending && !sharePrice)) && !metrics.isFetching;
  const isEstimateLoading = hasRedeemRaw && !isEstimateFailed && estimatedAssets === undefined;

  const validateForm = () => form.trigger('redeem', { shouldFocus: true });

  const handleRequestRedeem = async () => {
    const isValid = await validateForm();
    if (!isValid || isNotAllowlisted) return;
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

  useEffect(() => {
    if (account.address) form.clearErrors();
  }, [account.address, form]);

  const handleClaim = () => {
    if (claimableAssets <= 0n) return;

    claimRedeem.mutate({ claimableAssets });
  };

  const handleCancelRedeem = () => {
    if (pendingShares <= 0n || isShareReturnBlocked) return;

    cancelRedeem.mutate({ pendingShares });
  };

  const handleClaimReturnedShares = () => {
    if (returnedShares <= 0n || isShareReturnBlocked) return;

    claimReturnedShares.mutate({ returnedShares });
  };

  const receiveValue = estimatedAssets !== undefined ? formatUnits(estimatedAssets, USDC.decimals) : '';
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
                  isPrereqsLoading ||
                  isShareReturnBlocked ||
                  requestRedeem.isPending ||
                  claimRedeem.isPending ||
                  cancelRedeem.isPending
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
          {isShareReturnBlocked && <p className="text-extraSmall text-tertiary">Requires an allowlisted wallet.</p>}
        </div>
      )}

      {claimableAssets > 0n && (
        <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-regular text-primary">
              {formatBigIntWithCommas({ value: claimableAssets, tokenDecimals: USDC.decimals, displayDecimals: 2 })}{' '}
              USDC ready to claim
            </p>

            <ConnectedAccount fullWidth={false} type="skeleton">
              <Button
                onPress={handleClaim}
                size="s"
                isDisabled={
                  isPrereqsLoading ||
                  requestRedeem.isPending ||
                  cancelRedeem.isPending ||
                  claimReturnedShares.isPending ||
                  // The vault claims Returned Shares before USDC in one shared
                  // transaction path, so the USDC claim waits its turn.
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
        <CancellationProcessingStrip pendingShares={pendingShares} shareClass={share} />
      ) : (
        pendingShares > 0n && (
          <RedemptionProcessingStrip
            pendingShares={pendingShares}
            sharePrice={sharePrice}
            shareClass={share}
            cancel={{
              onPress: handleCancelRedeem,
              isDisabled:
                isPrereqsLoading ||
                isShareReturnBlocked ||
                requestRedeem.isPending ||
                claimRedeem.isPending ||
                claimReturnedShares.isPending,
              isBlockedByAllowlist: isShareReturnBlocked,
              isPending: cancelRedeem.isPending,
              isTxPending: cancelRedeem.isTxPending
            }}
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
                  <TokenDisplay symbol={share.symbol} />
                </div>
              </div>
            }
          />
        )}
      />

      <div className="flex flex-col gap-1.5">
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
              dollarValueDecimals={USDC.decimals}
              dollarValue={receiveDollarValue}
              isLoading={isEstimateLoading}
              balance={{ value: usdcBalance.data, isPending: usdcBalance.isPending, decimals: USDC.decimals }}
            />
          }
          endContent={<TokenDisplay symbol="USDC" />}
        />

        <Callout variant="warning">
          Redemptions are processed periodically. Your final USDC amount is determined using the Token Price when your
          request is processed.
        </Callout>
      </div>

      <ConnectedAccount>
        {isPrereqsLoading ? (
          <Button fullWidth isPending={true} pendingContent="Loading..." />
        ) : isCancellationProcessing ? (
          <Button fullWidth isDisabled>
            Cancellation in progress
          </Button>
        ) : isNotAllowlisted ? (
          <Button fullWidth isDisabled>
            Wallet Not Allowlisted
          </Button>
        ) : (
          <Button
            fullWidth
            onPress={() => void handleRequestRedeem()}
            isDisabled={
              isNotAllowlisted || claimRedeem.isPending || cancelRedeem.isPending || claimReturnedShares.isPending
            }
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

      {/* Why the action above is disabled — the verdict only exists once a
          wallet is connected. */}
      {isNotAllowlisted && <NotAllowlistedCallout />}
    </>
  );
}

function RedemptionProcessingStrip({
  pendingShares,
  sharePrice,
  shareClass,
  cancel
}: {
  pendingShares: bigint;
  sharePrice: bigint | undefined;
  shareClass: TransactedShareClass;
  cancel: {
    onPress: () => void;
    isDisabled: boolean;
    /** Narrows the generic disabled state to the one cause worth naming here. */
    isBlockedByAllowlist: boolean;
    isPending: boolean;
    isTxPending: boolean;
  };
}) {
  const pendingUsdc = sharePrice ? sharesToUsdc({ shares: pendingShares, sharePrice, shareClass }) : undefined;

  return (
    <div className="flex flex-col gap-1 rounded-sm border border-default bg-surface-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-regular text-primary">
          {formatBigIntWithCommas({ value: pendingShares, tokenDecimals: shareClass.decimals, displayDecimals: 2 })}{' '}
          {shareClass.symbol} processing
          {pendingUsdc !== undefined
            ? ` · ≈ ${formatBigIntWithCommas({ value: pendingUsdc, tokenDecimals: USDC.decimals, displayDecimals: 2 })} USDC`
            : ''}
        </p>

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
      </div>

      {/* The button is too narrow to carry the reason, and the callout at the
          foot of the panel is a long way from this control. */}
      {cancel.isBlockedByAllowlist && <p className="text-extraSmall text-tertiary">Requires an allowlisted wallet.</p>}
    </div>
  );
}

function CancellationProcessingStrip({
  pendingShares,
  shareClass
}: {
  pendingShares: bigint;
  shareClass: TransactedShareClass;
}) {
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
