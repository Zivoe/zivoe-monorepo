'use client';

import { ReactNode, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
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
import { useVault } from '@/hooks/useVault';

import ConnectedAccount from '@/components/connected-account';

export default function Deposit() {
  const [depositToken, setDepositToken] = useState<DepositToken>('USDC');
  const [receive, setReceive] = useState<string | undefined>(undefined);

  const account = useAccount();

  const depositBalances = useDepositBalances();

  const zvltBalance = useAccountBalance({ address: CONTRACTS.ZVLT });
  const vault = useVault();

  const isFetching = account.isPending || depositBalances.isFetching || zvltBalance.isFetching;

  const form = useForm<DepositForm>({
    resolver: zodResolver(
      getDepositFormSchema({
        balance: depositBalances.data?.[depositToken] ?? 0n,
        decimals: DEPOSIT_TOKEN_DECIMALS[depositToken]
      })
    ),
    defaultValues: { deposit: undefined },
    mode: 'onSubmit'
  });

  const handleDepositChange = (value: string) => {
    const receiveAmount = getReceiveAmount({
      deposit: value,
      totalSupply: vault.data?.totalSupply ?? 0n,
      totalAssets: vault.data?.totalAssets ?? 0n
    });

    setReceive(receiveAmount);
  };

  const handleSubmit = (data: DepositForm) => {
    console.log('SUBMIT: ', data);
  };

  return (
    <div className="sticky top-14 hidden rounded-2xl bg-surface-elevated p-2 lg:block lg:min-w-[24.75rem] xl:min-w-[39.375rem]">
      <div className="p-4">
        <p className="text-h6 text-primary">Deposit & Earn</p>
      </div>

      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-4 rounded-2xl bg-surface-base p-6 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]"
      >
        <Controller
          control={form.control}
          name="deposit"
          render={({ field: { value, onChange, ...field }, fieldState: { error, invalid } }) => (
            <Input
              {...field}
              variant="amount"
              label="Deposit"
              labelContent={<DepositTokenBalance token={depositToken} />}
              labelClassName="h-5"
              value={value ?? ''}
              onChange={(value) => {
                const parsedValue = parseInput(value);
                onChange(parsedValue || undefined);
                handleDepositChange(parsedValue);
              }}
              errorMessage={error?.message}
              isInvalid={invalid}
              isDisabled={isFetching}
              decimalPlaces={DEPOSIT_TOKEN_DECIMALS[depositToken]}
              endContent={
                <div className="flex items-center">
                  <DepositMaxButton
                    token={depositToken}
                    setDepositAmount={(value) => {
                      onChange(value);
                      handleDepositChange(value);
                    }}
                    isDisabled={isFetching}
                  />

                  <DepositTokenSelect
                    isDisabled={isFetching}
                    selected={depositToken}
                    onSelectionChange={(value: DepositToken) => {
                      setDepositToken(value);
                      setReceive(undefined);
                      form.setValue('deposit', undefined as any);
                      form.clearErrors('deposit');
                      form.setFocus('deposit');
                    }}
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
          value={receive ?? ''}
          onChange={(value) => {
            const parsedValue = parseInput(value);
            setReceive(parsedValue || undefined);
          }}
          isDisabled={isFetching}
          decimalPlaces={18}
        />

        <ConnectedAccount>
          <Button type="submit" fullWidth isPending={isFetching} pendingContent="Loading...">
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

const parseInput = (value: string) => {
  if (value.startsWith('.')) value = '0' + value;

  // Remove leading zeros
  return value.replace(/^0+(?=\d)/, '');
};

const DECIMALS_OFFSET = 0n;
const getReceiveAmount = ({
  deposit,
  totalSupply,
  totalAssets
}: {
  deposit: string;
  totalSupply: bigint;
  totalAssets: bigint;
}) => {
  let receive: string | undefined;
  if (!deposit) receive = undefined;
  else {
    const assets = parseUnits(deposit ?? '0', 18);
    const numerator = assets * (totalSupply + 10n ** DECIMALS_OFFSET);
    const denominator = totalAssets + 1n;
    const receiveAmount = numerator / denominator;
    receive = formatUnits(receiveAmount, 18);
  }

  return receive;
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
    <div className="flex items-center border-r border-default px-3">
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
            <SelectItem
              key={item.id}
              value={item}
              textValue={item.label}
              className="flex items-center gap-2 [&_svg]:size-5"
            >
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
