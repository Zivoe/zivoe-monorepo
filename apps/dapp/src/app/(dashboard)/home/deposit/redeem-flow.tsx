'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSetAtom } from 'jotai';
import { Controller, useForm } from 'react-hook-form';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';

import { CENTRIFUGE_CONFIG, sharesToUsdc, useInvestment, useRequestRedeem } from '@/centrifuge';

import { createTransactionProperties } from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { depositDialogAtom } from '@/lib/store';
import { formatBigIntWithCommas } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useBalance } from '@/hooks/useBalance';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useCurrentShareMetrics } from '@/hooks/useCurrentShareMetrics';

import ConnectedAccount from '@/components/connected-account';

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
    redeemRaw !== undefined && sharePrice ? (redeemRaw * sharePrice) / 10n ** BigInt(ZMCA.decimals) : redeem ? null : 0n;

  const requestRedeem = useRequestRedeem({ onSuccessClose: () => setIsDepositDialogOpen(false) });

  const isFetching =
    account.isPending ||
    zMcaBalance.isFetching ||
    usdcBalance.isFetching ||
    chainalysis.isFetching ||
    investment.isFetching ||
    metrics.isPending;

  const isDisabled = isFetching || requestRedeem.isPending;
  const isEstimateUnavailable = metrics.isError;

  const validateForm = () => form.trigger('redeem', { shouldFocus: true });

  const handleRequestRedeem = async () => {
    const isValid = await validateForm();
    if (!isValid || isEstimateUnavailable) return;
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
      { onSuccess: () => form.reset({ redeem: undefined }) }
    );
  };

  useEffect(() => {
    if (account.address) form.clearErrors();
  }, [account.address]);

  return (
    <>
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
            isDisabled={isDisabled}
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
                  isDisabled={isDisabled}
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
          value={isEstimateUnavailable ? '—' : estimatedAssets !== undefined ? formatUnits(estimatedAssets, USDC.decimals) : ''}
          isDisabled
          hasNormalStyleIfDisabled={!isDisabled}
          subContent={
            <InputExtraInfo
              decimals={USDC.decimals}
              dollarValue={estimatedAssets ?? (redeem ? null : 0n)}
              balance={{ value: usdcBalance.data, isPending: usdcBalance.isPending }}
            />
          }
          endContent={<TokenDisplay symbol="USDC" />}
        />

        <p className="text-extraSmall text-tertiary">
          Your final USDC amount is determined using the Share Price when your request is processed.
        </p>
      </div>

      <ConnectedAccount>
        {isFetching ? (
          <Button fullWidth isPending={true} pendingContent="Loading..." />
        ) : (
          <Button
            fullWidth
            onPress={() => void handleRequestRedeem()}
            isDisabled={hasRedeemRaw && isEstimateUnavailable}
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
    <div className="rounded-sm border border-default bg-surface-elevated p-4">
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
