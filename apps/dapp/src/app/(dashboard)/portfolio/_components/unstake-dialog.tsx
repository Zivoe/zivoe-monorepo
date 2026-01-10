'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { parseUnits } from 'viem';
import { z } from 'zod';

import { CONTRACTS } from '@zivoe/contracts';
import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Input } from '@zivoe/ui/core/input';

import { useAccount } from '@/hooks/useAccount';
import { useAccountBalance } from '@/hooks/useAccountBalance';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useDepositBalances } from '@/hooks/useDepositBalances';

import ConnectedAccount from '@/components/connected-account';

import { InputExtraInfo } from '@/app/(dashboard)/home/deposit/_components/input-extra-info';
import { MaxButton } from '@/app/(dashboard)/home/deposit/_components/max-button';
import { TokenDisplay } from '@/app/(dashboard)/home/deposit/_components/token-display';
import { TransactionDialog } from '@/app/(dashboard)/home/deposit/_components/transaction-dialog';
import { createAmountValidator, parseInput } from '@/app/(dashboard)/home/deposit/_utils';

import { useUnstakeStSTT } from '../_hooks/useUnstakeStSTT';

type UnstakeForm = z.infer<z.ZodObject<{ unstake: ReturnType<typeof createAmountValidator> }>>;

export function UnstakeDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const [receive, setReceive] = useState<string | undefined>(undefined);

  const account = useAccount();
  const chainalysis = useChainalysis();

  const stSTTBalance = useAccountBalance({ address: CONTRACTS.stSTT });
  const depositBalances = useDepositBalances();

  const form = useForm<UnstakeForm>({
    resolver: zodResolver(
      z.object({
        unstake: createAmountValidator({
          balance: stSTTBalance.data ?? 0n,
          decimals: 18,
          requiredMessage: 'stSTT amount is required',
          exceedsMessage: 'stSTT amount exceeds balance'
        })
      })
    ),
    defaultValues: { unstake: undefined },
    mode: 'onChange'
  });

  const unstake = form.watch('unstake');
  const unstakeRaw = unstake ? parseUnits(unstake, 18) : undefined;
  const hasUnstakeRaw = unstakeRaw !== undefined && unstakeRaw > 0n;

  const unstakeStSTT = useUnstakeStSTT();

  const isFetching =
    account.isPending || stSTTBalance.isFetching || depositBalances.isFetching || chainalysis.isFetching;

  const isDisabled = isFetching || unstakeStSTT.isPending;

  const validateForm = () => form.trigger('unstake', { shouldFocus: true });

  const handleUnstakeSuccess = () => {
    form.reset();
    setReceive(undefined);
  };

  const handleUnstake = async () => {
    const isValid = await validateForm();
    if (!isValid) return;

    unstakeStSTT.mutate({ amount: unstakeRaw }, { onSuccess: handleUnstakeSuccess });
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setReceive(undefined);
    }
  }, [isOpen]);

  return (
    <>
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
        <DialogContent dialogClassName="gap-0" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Unstake</DialogTitle>
          </DialogHeader>

          <DialogContentBox className="gap-4 p-4">
            <Controller
              control={form.control}
              name="unstake"
              render={({ field: { value, onChange, ...field }, fieldState: { error, invalid } }) => (
                <Input
                  {...field}
                  inputMode="decimal"
                  variant="amount"
                  label="Unstake"
                  labelClassName="h-5"
                  value={value ?? ''}
                  onChange={(value) => {
                    const parsedValue = parseInput(value);
                    onChange(parsedValue || undefined);
                    setReceive(parsedValue);
                  }}
                  errorMessage={error?.message}
                  isInvalid={invalid}
                  isDisabled={isDisabled}
                  decimalPlaces={18}
                  subContent={
                    <InputExtraInfo
                      decimals={18}
                      dollarValue={unstakeRaw ?? 0n}
                      balance={{ value: stSTTBalance.data, isPending: stSTTBalance.isPending }}
                    />
                  }
                  endContent={
                    <div className="flex items-center">
                      <MaxButton
                        balance={stSTTBalance.data ?? 0n}
                        decimals={18}
                        onPress={(value) => {
                          onChange(value);
                          setReceive(value);
                        }}
                        isDisabled={isDisabled}
                      />

                      <div className="ml-3">
                        <TokenDisplay symbol="stSTT" />
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
              value={receive ?? ''}
              isDisabled
              hasNormalStyleIfDisabled={!isDisabled}
              subContent={
                <InputExtraInfo
                  decimals={18}
                  dollarValue={receive ? parseUnits(receive, 18) : 0n}
                  balance={{ value: depositBalances.data?.zSTT ?? 0n, isPending: depositBalances.isPending }}
                />
              }
              endContent={<TokenDisplay symbol="zSTT" />}
            />

            <ConnectedAccount>
              {isFetching ? (
                <Button fullWidth isPending={true} pendingContent="Loading..." />
              ) : !hasUnstakeRaw ? (
                <Button fullWidth onPress={handleUnstake}>
                  Unstake
                </Button>
              ) : (
                <Button
                  fullWidth
                  onPress={handleUnstake}
                  isPending={unstakeStSTT.isPending}
                  pendingContent={
                    unstakeStSTT.isTxPending
                      ? 'Unstaking stSTT...'
                      : unstakeStSTT.isPending
                        ? 'Signing Transaction...'
                        : undefined
                  }
                >
                  Unstake
                </Button>
              )}
            </ConnectedAccount>
          </DialogContentBox>
        </DialogContent>
      </Dialog>

      <TransactionDialog />
    </>
  );
}
