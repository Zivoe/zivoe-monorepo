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
  useRedemptionPosition,
  useRequestRedeem
} from '@/centrifuge';

import { useOfferingIdentity } from '../offering-provider';
import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
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
    (position.isFetching && !isCancellationProcessing) ||
    // isPending on purpose: metrics refetch on a 5-minute interval, and
    // isFetching would flash the whole form to loading on every refresh.
    metrics.isPending;

  const isMutationPending =
    requestRedeem.isPending || claimRedeem.isPending || cancelRedeem.isPending || claimReturnedShares.isPending;
  // Cancellation Processing locks the whole form: a new request would revert
  // on-chain until the hub finishes the unwind.
  const isFormLocked = isPrereqsLoading || isMutationPending || isCancellationProcessing;

  // Page-level failure surfaces immediately; a retry in flight shows loading
  // rather than the stale error. A fetched Share Price of 0 (pre-first-price
  // row or upstream glitch) also fails the estimate — a truthiness pass-through
  // would park the submit in a permanent 'Estimating USDC...' state instead.
  const isEstimateFailed = (metrics.isError || (!metrics.isPending && !sharePrice)) && !metrics.isFetching;
  // Only manifests during an error retry — the initial metrics load already
  // locks the whole form through isPrereqsLoading.
  const isEstimateLoading = hasRedeemRaw && !isEstimateFailed && estimatedAssets === undefined;

  // A failed position read renders like "no position" (the ?? 0n fallbacks
  // above), so a new request must not be offered on top of state we cannot
  // see — the read failing is also how a misconfigured vault surfaces.
  const isPositionUnavailable = position.isError;

  const validateForm = () => form.trigger('redeem', { shouldFocus: true });

  const handleRequestRedeem = async () => {
    const isValid = await validateForm();
    if (!isValid || isEstimateFailed || isEstimateLoading || isPositionUnavailable) return;
    // Narrowing only — validation guarantees redeemRaw and the estimate states
    // cover every missing-estimate case.
    if (!redeemRaw || estimatedAssets === undefined) return;

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
    if (pendingShares <= 0n) return;

    cancelRedeem.mutate({ pendingShares });
  };

  const handleClaimReturnedShares = () => {
    if (returnedShares <= 0n) return;

    claimReturnedShares.mutate({ returnedShares });
  };

  const receiveValue = estimatedAssets !== undefined ? formatUnits(estimatedAssets, USDC.decimals) : '';
  // Suppress the amount input's `0.0` ghost while the estimate is loading —
  // it would otherwise read as "you receive 0.0" next to the skeleton.
  const receivePlaceholder = isEstimateLoading ? '' : undefined;
  const receiveDollarValue = isEstimateFailed ? 0n : (estimatedAssets ?? (redeem ? null : 0n));

  return (
    <>
      {isPositionUnavailable && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-default bg-surface-elevated p-4">
          <p className="text-regular text-primary">
            Unable to load your redemption position — pending and claimable amounts may not be shown.
          </p>

          <Button variant="link-alert" size="s" onPress={() => void position.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {returnedShares > 0n && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-default bg-surface-elevated p-4">
          <p className="text-regular text-primary">
            {formatBigIntWithCommas({ value: returnedShares, tokenDecimals: share.decimals, displayDecimals: 2 })}{' '}
            {share.symbol} returned from cancellation
          </p>

          <ConnectedAccount fullWidth={false} type="skeleton">
            <Button
              onPress={handleClaimReturnedShares}
              size="s"
              isDisabled={
                isPrereqsLoading || requestRedeem.isPending || claimRedeem.isPending || cancelRedeem.isPending
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
                isPrereqsLoading || requestRedeem.isPending || claimRedeem.isPending || claimReturnedShares.isPending,
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
                // decimals are; only the balance renders at the token's scale.
                decimals={18}
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
              decimals={USDC.decimals}
              dollarValue={receiveDollarValue}
              isLoading={isEstimateLoading}
              balance={{ value: usdcBalance.data, isPending: usdcBalance.isPending }}
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
        ) : (
          <Button
            fullWidth
            onPress={() => void handleRequestRedeem()}
            isDisabled={
              isEstimateFailed ||
              isPositionUnavailable ||
              claimRedeem.isPending ||
              cancelRedeem.isPending ||
              claimReturnedShares.isPending
            }
            isPending={requestRedeem.isPending || isEstimateLoading}
            pendingContent={
              isEstimateLoading
                ? 'Estimating USDC...'
                : requestRedeem.isTxPending
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
  cancel: { onPress: () => void; isDisabled: boolean; isPending: boolean; isTxPending: boolean };
}) {
  const pendingUsdc = sharePrice ? sharesToUsdc({ shares: pendingShares, sharePrice, shareClass }) : undefined;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-default bg-surface-elevated p-4">
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
