'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { formatUnits, parseUnits } from 'viem';
import { erc20Abi } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';

import { CONTRACTS } from '@/lib/constants';
import { formatBigIntWithCommas } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useAccountBalance } from '@/hooks/useAccountBalance';
import { checkHasEnoughAllowance, useAllowance } from '@/hooks/useAllowance';
import { useApproveSpending } from '@/hooks/useApproveSpending';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useDepositBalances } from '@/hooks/useDepositBalances';
import { useRedemption } from '@/hooks/useRedemption';
import { useVault } from '@/hooks/useVault';

import ConnectedAccount from '@/components/connected-account';

import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { TokenDisplay } from './_components/token-display';
import { useAvailableLiquidity } from './_hooks/useAvailableLiquidity';
import { useRedeemUSDC } from './_hooks/useRedeemUSDC';
import { calculateZVLTDollarValue, createAmountValidator, parseInput } from './_utils';

type RedeemForm = z.infer<z.ZodObject<{ redeem: ReturnType<typeof createAmountValidator> }>>;

type Receive = {
  value: string | undefined;
  fee: bigint | undefined;
};

export default function RedeemFlow({ indexPrice }: { indexPrice: number | null }) {
  const [receive, setReceive] = useState<Receive>({ value: undefined, fee: undefined });

  const account = useAccount();
  const chainalysis = useChainalysis();

  const liquidity = useAvailableLiquidity();
  const zvltAllowance = useAllowance({ contract: CONTRACTS.zVLT, spender: CONTRACTS.OCR });
  const zvltBalance = useAccountBalance({ address: CONTRACTS.zVLT });

  const depositBalances = useDepositBalances();

  const vault = useVault();
  const redemption = useRedemption();

  const form = useForm<RedeemForm>({
    resolver: zodResolver(
      z.object({
        redeem: createAmountValidator({
          balance: zvltBalance.data ?? 0n,
          decimals: 18,
          requiredMessage: 'Redeem amount is required',
          exceedsMessage: 'Redeem amount exceeds balance'
        }).superRefine((amount, ctx) => {
          if (amount && liquidity.data !== undefined) {
            const { usdcAmount } = getRedeemAmount({
              zVLTAmount: amount,
              totalSupply: vault.data?.totalSupply ?? 0n,
              totalAssets: vault.data?.totalAssets ?? 0n,
              redemptionFeeBIPS: redemption.data?.redemptionFeeBIPS ?? 0n
            });

            if (usdcAmount) {
              const receiveAmount = parseUnits(usdcAmount, 18);

              if (receiveAmount > liquidity.data) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: 'Redemption amount exceeds available liquidity'
                });
              }
            }
          }
        })
      })
    ),
    defaultValues: { redeem: undefined },
    mode: 'onChange'
  });

  const redeem = form.watch('redeem');
  const redeemRaw = redeem ? parseUnits(redeem, 18) : undefined;
  const hasRedeemRaw = redeemRaw !== undefined && redeemRaw > 0n;

  const zVLTDollarValue = calculateZVLTDollarValue({ amount: redeem, indexPrice });

  const hasEnoughAllowance = checkHasEnoughAllowance({
    allowance: zvltAllowance.data,
    amount: redeemRaw
  });

  const approveSpending = useApproveSpending();
  const redeemUSDC = useRedeemUSDC();

  const isFetching =
    account.isPending ||
    liquidity.isFetching ||
    zvltBalance.isFetching ||
    depositBalances.isFetching ||
    zvltAllowance.isFetching ||
    chainalysis.isFetching;

  const isDisabled = isFetching || approveSpending.isPending || redeemUSDC.isPending;

  const handleRedeemChange = (value: string) => {
    const { usdcAmount, fee } = getRedeemAmount({
      zVLTAmount: value,
      totalSupply: vault.data?.totalSupply ?? 0n,
      totalAssets: vault.data?.totalAssets ?? 0n,
      redemptionFeeBIPS: redemption.data?.redemptionFeeBIPS ?? 0n
    });

    setReceive({ value: usdcAmount, fee });
  };

  const validateForm = () => form.trigger('redeem', { shouldFocus: true });

  const handleApprove = async () => {
    const isValid = await validateForm();
    if (!isValid) return;

    approveSpending.mutate({
      contract: CONTRACTS.zVLT,
      spender: CONTRACTS.OCR,
      amount: redeemRaw,
      name: 'zVLT',
      abi: erc20Abi
    });
  };

  const handleRedeemSuccess = () => {
    form.reset();
    setReceive({ value: undefined, fee: undefined });
  };

  const handleRedeem = async () => {
    const isValid = await validateForm();
    if (!isValid) return;

    redeemUSDC.mutate({ amount: redeemRaw }, { onSuccess: handleRedeemSuccess });
  };

  useEffect(() => {
    if (account.address) form.clearErrors();
  }, [account.address]);

  return (
    <>
      <Controller
        control={form.control}
        name="redeem"
        render={({ field: { value, onChange, ...field }, fieldState: { error, invalid } }) => (
          <Input
            {...field}
            inputMode="decimal"
            variant="amount"
            label="Redeem"
            labelClassName="h-5"
            value={value ?? ''}
            onChange={(value) => {
              const parsedValue = parseInput(value);
              onChange(parsedValue || undefined);
              handleRedeemChange(parsedValue);
            }}
            errorMessage={error?.message}
            isInvalid={invalid}
            isDisabled={isDisabled}
            decimalPlaces={18}
            subContent={
              <InputExtraInfo
                decimals={18}
                dollarValue={zVLTDollarValue}
                balance={{ value: zvltBalance.data, isPending: zvltBalance.isPending }}
              />
            }
            endContent={
              <div className="flex items-center">
                <MaxButton
                  balance={zvltBalance.data ?? 0n}
                  decimals={18}
                  onPress={(value) => {
                    onChange(value);
                    handleRedeemChange(value);
                  }}
                  isDisabled={isDisabled}
                />

                <div className="ml-3">
                  <TokenDisplay symbol="zVLT" />
                </div>
              </div>
            }
          />
        )}
      />

      <Input
        variant="amount"
        label="Receive"
        labelClassName="h-5"
        value={receive.value ?? ''}
        isDisabled
        hasNormalStyleIfDisabled={!isDisabled}
        subContent={
          <InputExtraInfo
            decimals={6}
            dollarValue={receive.value ? parseUnits(receive.value, 6) : 0n}
            balance={{ value: depositBalances.data?.USDC ?? 0n, isPending: depositBalances.isPending }}
          />
        }
        endContent={<TokenDisplay symbol="USDC" />}
      />

      {redemption.data && receive.fee && redeem ? (
        <div className="flex flex-wrap justify-between gap-2 rounded-[4px] border border-default bg-surface-elevated p-4">
          <p className="text-regular text-secondary">
            Redemption Fee ({formatBigIntWithCommas({ value: redemption.data?.redemptionFeeBIPS, tokenDecimals: 2 })}%)
          </p>

          <p className="text-regular text-primary">
            ${formatBigIntWithCommas({ value: receive.fee, tokenDecimals: 18 })}
          </p>
        </div>
      ) : null}

      <ConnectedAccount>
        {isFetching ? (
          <Button fullWidth isPending={true} pendingContent="Loading..." />
        ) : !hasRedeemRaw ? (
          <Button fullWidth onPress={handleRedeem}>
            Redeem
          </Button>
        ) : !hasEnoughAllowance ? (
          <Button
            fullWidth
            onPress={handleApprove}
            isPending={approveSpending.isPending}
            pendingContent={
              approveSpending.isTxPending
                ? 'Approving zVLT...'
                : approveSpending.isPending
                  ? 'Signing Transaction...'
                  : undefined
            }
          >
            Approve
          </Button>
        ) : (
          <Button
            fullWidth
            onPress={handleRedeem}
            isPending={redeemUSDC.isPending}
            pendingContent={
              redeemUSDC.isTxPending ? 'Redeeming zVLT...' : redeemUSDC.isPending ? 'Signing Transaction...' : undefined
            }
          >
            Redeem
          </Button>
        )}
      </ConnectedAccount>
    </>
  );
}

const DECIMALS_OFFSET = 0n;
const BIPS = 10000n;

// calculateRedemptionAmount in OCR_Instant contract
const getRedeemAmount = ({
  zVLTAmount,
  totalSupply,
  totalAssets,
  redemptionFeeBIPS
}: {
  zVLTAmount: string;
  totalSupply: bigint;
  totalAssets: bigint;
  redemptionFeeBIPS: bigint;
}) => {
  if (!zVLTAmount) return { usdcAmount: undefined, fee: undefined };

  const shares = parseUnits(zVLTAmount, 18);

  // zVLT convertToAssets function
  const zSTTReceived = (shares * (totalAssets + 1n)) / (totalSupply + 10n ** DECIMALS_OFFSET);

  const fee = (zSTTReceived * redemptionFeeBIPS) / BIPS;
  const usdcAmountRaw = zSTTReceived - fee;

  let usdcAmount = formatUnits(usdcAmountRaw, 18);
  usdcAmount = usdcAmount.replace(/(\.\d{6}).*/, '$1');

  return { usdcAmount, fee };
};
