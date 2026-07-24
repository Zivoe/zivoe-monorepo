'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSetAtom } from 'jotai';
import { Controller, useForm } from 'react-hook-form';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';
import { Skeleton } from '@zivoe/ui/core/skeleton';

import { createTransactionProperties } from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { depositDialogAtom } from '@/lib/store';
import { formatBigIntWithCommas } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useBalance } from '@/hooks/useBalance';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useCurrentShareMetrics } from '@/hooks/useCurrentShareMetrics';

import ConnectedAccount from '@/components/connected-account';

import { CENTRIFUGE_CONFIG, sharesToUsdc, useClaimRedeem, useInvestment, useRequestRedeem } from '@/centrifuge';

import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { TokenDisplay } from './_components/token-display';
import { createAmountValidator, parseInput } from './_utils';

const USDC = CENTRIFUGE_CONFIG.usdc;
const ZMCA = CENTRIFUGE_CONFIG.shareToken;

type RedeemForm = { redeem: string };

export default function RedeemFlow() {
  const account = useAccount();
  const analytics = useAnalytics();
  const chainalysis = useChainalysis();
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const zMcaBalance = useBalance({ tokenAddress: ZMCA.address });
  const usdcBalance = useBalance({ tokenAddress: USDC.address });
  const investment = useInvestment();
  const metrics = useCurrentShareMetrics();

  const sharePrice = metrics.data?.sharePrice;
  const pendingShares = investment.data?.pendingRedeemShares ?? 0n;
  const claimableAssets = investment.data?.claimableRedeemAssets ?? 0n;
  const hasPosition = pendingShares > 0n || claimableAssets > 0n;

  const form = useForm<RedeemForm>({
    resolver: zodResolver(
      z.object({
        redeem: createAmountValidator({
          balance: zMcaBalance.data ?? 0n,
          decimals: ZMCA.decimals,
          requiredMessage: 'Redeem amount is required',
          exceedsMessage: 'Redeem amount exceeds balance'
        })
      })
    ),
    defaultValues: { redeem: undefined },
    mode: 'onChange'
  });

  const redeem = form.watch('redeem');
  const redeemRaw = redeem ? parseUnits(redeem, ZMCA.decimals) : undefined;
  const hasRedeemRaw = redeemRaw !== undefined && redeemRaw > 0n;

  const estimatedAssets = hasRedeemRaw && sharePrice ? sharesToUsdc({ shares: redeemRaw, sharePrice }) : undefined;
  const redeemDollarValue =
    redeemRaw !== undefined && sharePrice
      ? (redeemRaw * sharePrice) / 10n ** BigInt(ZMCA.decimals)
      : redeem
        ? null
        : 0n;

  const requestRedeem = useRequestRedeem({ onSuccessClose: () => setIsDepositDialogOpen(false) });
  const claimRedeem = useClaimRedeem({ onSuccessClose: () => setIsDepositDialogOpen(false) });

  // Balances/investment use isFetching so post-transaction invalidations keep
  // the form locked until fresh data lands.
  const isPrereqsLoading =
    account.isPending ||
    zMcaBalance.isFetching ||
    usdcBalance.isFetching ||
    chainalysis.isFetching ||
    investment.isFetching ||
    // isPending on purpose: metrics refetch on a 5-minute interval, and
    // isFetching would flash the whole form to loading on every refresh.
    metrics.isPending;

  const isFormLocked = isPrereqsLoading || requestRedeem.isPending || claimRedeem.isPending;

  // Page-level failure surfaces immediately; a retry in flight shows loading
  // rather than the stale error. A fetched Share Price of 0 (pre-first-price
  // row or upstream glitch) also fails the estimate — a truthiness pass-through
  // would park the submit in a permanent 'Estimating USDC...' state instead.
  const isEstimateFailed = (metrics.isError || (!metrics.isPending && !sharePrice)) && !metrics.isFetching;
  // Only manifests during an error retry — the initial metrics load already
  // locks the whole form through isPrereqsLoading.
  const isEstimateLoading = hasRedeemRaw && !isEstimateFailed && estimatedAssets === undefined;

  const validateForm = () => form.trigger('redeem', { shouldFocus: true });

  const handleRequestRedeem = async () => {
    const isValid = await validateForm();
    if (!isValid || isEstimateFailed || isEstimateLoading) return;
    // Narrowing only — validation guarantees redeemRaw and the estimate states
    // cover every missing-estimate case.
    if (!redeemRaw || estimatedAssets === undefined) return;

    analytics.capture(
      'tx:redeem_started',
      createTransactionProperties({
        flow: 'redeem',
        step: 'started',
        walletAddress: account.address,
        chainId: CENTRIFUGE_CONFIG.chainId,
        tokenIn: 'zMCA',
        tokenOut: 'USDC',
        amountInRaw: redeemRaw,
        amountOutRaw: estimatedAssets
      })
    );

    requestRedeem.mutate(
      { shares: redeemRaw, estimatedAssets },
      // A reverted receipt also resolves as mutation success (it routes to the
      // failure dialog) — keep the entered amount so the user can retry as-is.
      { onSuccess: ({ receipt }) => receipt.status === 'success' && form.reset({ redeem: undefined }) }
    );
  };

  useEffect(() => {
    if (account.address) form.clearErrors();
  }, [account.address]);

  const handleClaim = () => {
    if (claimableAssets <= 0n) return;
    claimRedeem.mutate({ claimableAssets });
  };

  const receiveValue = estimatedAssets !== undefined ? formatUnits(estimatedAssets, USDC.decimals) : '';
  // Suppress the amount input's `0.0` ghost while the estimate is loading —
  // it would otherwise read as "you receive 0.0" next to the skeleton.
  const receivePlaceholder = isEstimateLoading ? '' : undefined;
  const receiveDollarValue = isEstimateFailed ? 0n : (estimatedAssets ?? (redeem ? null : 0n));

  return (
    <>
      {claimableAssets > 0n && (
        <div className="border-default bg-surface-elevated flex flex-wrap items-center justify-between gap-3 rounded-sm border p-4">
          <p className="text-regular text-primary">
            {formatBigIntWithCommas({ value: claimableAssets, tokenDecimals: USDC.decimals, displayDecimals: 2 })} USDC
            ready to claim
          </p>

          <ConnectedAccount fullWidth={false} type="skeleton">
            <Button
              onPress={handleClaim}
              size="s"
              isDisabled={isPrereqsLoading || requestRedeem.isPending}
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
      )}

      {pendingShares > 0n && <RedemptionProcessingStrip pendingShares={pendingShares} sharePrice={sharePrice} />}

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
            decimalPlaces={ZMCA.decimals}
            subContent={
              <InputExtraInfo
                decimals={ZMCA.decimals}
                dollarValue={redeemDollarValue}
                balance={{ value: zMcaBalance.data, isPending: zMcaBalance.isPending }}
              />
            }
            endContent={
              <div className="flex items-center">
                <MaxButton
                  balance={zMcaBalance.data ?? 0n}
                  decimals={ZMCA.decimals}
                  onPress={(value) => onChange(value)}
                  isDisabled={isFormLocked}
                />

                <div className="ml-3">
                  <TokenDisplay symbol="zMCA" />
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

        <p className="text-extraSmall text-tertiary">
          Redemptions are processed periodically. Your final USDC amount is determined using the Share Price when your
          request is processed.
        </p>
      </div>

      <ConnectedAccount>
        {isPrereqsLoading ? (
          <Button fullWidth isPending={true} pendingContent="Loading..." />
        ) : (
          <Button
            fullWidth
            onPress={() => void handleRequestRedeem()}
            isDisabled={isEstimateFailed || claimRedeem.isPending}
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
  sharePrice
}: {
  pendingShares: bigint;
  sharePrice: bigint | undefined;
}) {
  const pendingUsdc = sharePrice ? sharesToUsdc({ shares: pendingShares, sharePrice }) : undefined;

  return (
    <div className="border-default bg-surface-elevated rounded-sm border p-4">
      <p className="text-regular text-primary">
        {formatBigIntWithCommas({ value: pendingShares, tokenDecimals: ZMCA.decimals, displayDecimals: 2 })} zMCA
        processing
        {pendingUsdc !== undefined
          ? ` · ≈ ${formatBigIntWithCommas({ value: pendingUsdc, tokenDecimals: USDC.decimals, displayDecimals: 2 })} USDC`
          : ''}
      </p>
    </div>
  );
}
