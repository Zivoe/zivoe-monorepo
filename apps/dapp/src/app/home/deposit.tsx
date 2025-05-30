'use client';

import { ReactNode, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button, ButtonProps } from '@zivoe/ui/core/button';
import { Input } from '@zivoe/ui/core/input';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { UsdtIcon, ZsttIcon } from '@zivoe/ui/icons';
import { UsdcIcon } from '@zivoe/ui/icons';
import { FraxIcon } from '@zivoe/ui/icons/frax';

import { DEPOSIT_TOKENS, DEPOSIT_TOKEN_DECIMALS, DepositToken } from '@/types/constants';

import { CONTRACTS } from '@/lib/constants';
import { formatBigIntToReadable } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useAccountBalance } from '@/hooks/useAccountBalance';
import { useDepositBalances } from '@/hooks/useDepositBalances';

import ConnectedAccount from '@/components/connected-account';

export default function Deposit() {
  const [depositToken, setDepositToken] = useState<DepositToken>('USDC');
  const [receive, setReceive] = useState('');

  const account = useAccount();

  const depositBalances = useDepositBalances();

  const zvltBalance = useAccountBalance({ address: CONTRACTS.ZVLT });

  const isFetching = account.isPending || depositBalances.isFetching || zvltBalance.isFetching;

  const form = useForm<DepositForm>({
    resolver: zodResolver(
      getDepositFormSchema({
        balance: depositBalances.data?.[depositToken] ?? 0n,
        decimals: DEPOSIT_TOKEN_DECIMALS[depositToken]
      })
    ),
    defaultValues: { deposit: undefined },
    mode: 'onChange'
  });

  return (
    <div className="sticky top-14 hidden rounded-2xl bg-surface-elevated p-2 lg:block lg:min-w-[24.75rem] xl:min-w-[39.375rem]">
      <div className="p-4">
        <p className="text-h6 text-primary">Deposit & Earn</p>
      </div>

      <form className="flex flex-col gap-4 rounded-2xl bg-surface-base p-6 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
        <Controller
          control={form.control}
          name="deposit"
          render={({ field: { value, onChange, ...field }, fieldState: { error, invalid } }) => (
            <Input
              variant="amount"
              label="Deposit"
              labelContent={<DepositTokenBalance token={depositToken} />}
              labelClassName="h-5"
              {...field}
              value={value ?? ''}
              onChange={(value) => onChangeAmount({ value, onChange })}
              errorMessage={error?.message}
              isInvalid={invalid}
              isDisabled={isFetching}
              decimalPlaces={DEPOSIT_TOKEN_DECIMALS[depositToken]}
              endContent={
                <div className="flex items-center">
                  <DepositMaxButton token={depositToken} setDepositAmount={onChange} isDisabled={isFetching} />

                  <DepositTokenSelect
                    isDisabled={isFetching}
                    selected={depositToken}
                    onSelectionChange={setDepositToken}
                  />
                </div>
              }
            />
          )}
        />

        <Input
          variant="amount"
          label="Receive"
          labelContent={<ZvltBalance />}
          labelClassName="h-5"
          value={receive}
          onChange={(value) => setReceive(value)}
          isDisabled={isFetching}
          decimalPlaces={18}
        />

        <ConnectedAccount>
          <Button fullWidth isPending={isFetching} pendingContent="Loading...">
            Deposit
          </Button>
        </ConnectedAccount>
      </form>
    </div>
  );
}

const getDepositFormSchema = ({ balance, decimals }: { balance: bigint; decimals: number }) =>
  z.object({
    deposit: z.string({ required_error: 'Deposit amount is required' }).superRefine((amount, ctx) => {
      const parsedAmount = parseUnits(amount, decimals);

      if (parsedAmount === 0n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Deposit amount is required'
        });
      }

      if (parsedAmount > balance) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Deposit amount exceeds balance'
        });
      }
    })
  });

type DepositForm = z.infer<ReturnType<typeof getDepositFormSchema>>;

const onChangeAmount = ({ value, onChange }: { value: string; onChange: (...event: any[]) => void }) => {
  if (value.startsWith('.')) value = '0' + value;

  // Remove leading zeros
  value = value.replace(/^0+(?=\d)/, '');

  onChange(value || undefined);
};

function DepositTokenBalance({ token }: { token: DepositToken }) {
  const depositBalances = useDepositBalances();
  if (depositBalances.isPending || depositBalances.data === undefined) return null;

  return (
    <p className="text-small text-primary">
      Balance: {formatBigIntToReadable(depositBalances.data[token], DEPOSIT_TOKEN_DECIMALS[token])}
    </p>
  );
}

const DEPOSIT_TOKEN_ICON: Record<DepositToken, ReactNode> = {
  USDC: <UsdcIcon />,
  USDT: <UsdtIcon />,
  FRX: <FraxIcon />,
  zSTT: <ZsttIcon />
};

const DEPOSIT_TOKENS_SELECT_ITEMS = DEPOSIT_TOKENS.map((token, index) => ({
  id: token,
  label: token,
  icon: DEPOSIT_TOKEN_ICON[token]
}));

function DepositMaxButton({
  token,
  isDisabled,
  setDepositAmount
}: {
  token: DepositToken;
  isDisabled: boolean;
  setDepositAmount: (value: string) => void;
}) {
  const depositBalances = useDepositBalances();
  const hasDepositBalance = !!depositBalances.data && depositBalances.data[token] > 0n;

  if (!hasDepositBalance) return null;

  const handleMaxDeposit = () => {
    const balance = depositBalances.data?.[token] ?? 0n;
    const decimals = DEPOSIT_TOKEN_DECIMALS[token];
    const maxAmount = formatUnits(balance, decimals);

    setDepositAmount(maxAmount);
  };

  return (
    <div className="border-r border-default px-3">
      <Button variant="border-light" size="s" isDisabled={isDisabled} onPress={handleMaxDeposit}>
        Max
      </Button>
    </div>
  );
}

function DepositTokenSelect({
  selected,
  onSelectionChange,
  isDisabled
}: {
  selected: DepositToken;
  isDisabled: boolean;
  onSelectionChange: (value: DepositToken) => void;
}) {
  return (
    <Select
      placeholder="Select"
      aria-label="Select a chart view"
      selectedKey={selected}
      onSelectionChange={(value) => onSelectionChange(value as DepositToken)}
      isDisabled={isDisabled}
      className="ml-3"
    >
      <SelectTrigger className="w-[7.375rem] justify-between">
        <SelectValue className="flex items-center gap-2 [&_svg]:size-6" />
      </SelectTrigger>

      <SelectPopover>
        <SelectListBox items={DEPOSIT_TOKENS_SELECT_ITEMS}>
          {(item) => (
            <SelectItem key={item.id} value={item} className="flex items-center gap-2 [&_svg]:size-5">
              {item.icon}
              {item.label}
            </SelectItem>
          )}
        </SelectListBox>
      </SelectPopover>
    </Select>
  );
}

function ZvltBalance() {
  const zvltBalance = useAccountBalance({ address: CONTRACTS.ZVLT });
  if (zvltBalance.isPending || zvltBalance.data === undefined) return null;

  return <p className="text-small text-primary">Balance: {formatBigIntToReadable(zvltBalance.data)}</p>;
}
