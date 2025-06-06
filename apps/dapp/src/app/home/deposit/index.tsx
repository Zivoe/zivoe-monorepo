'use client';

import { ReactNode, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import * as Aria from 'react-aria-components';
import { Controller, useForm } from 'react-hook-form';
import { useMediaQuery } from 'react-responsive';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Input } from '@zivoe/ui/core/input';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { FrxUsdIcon, UsdcIcon, UsdtIcon, ZsttIcon } from '@zivoe/ui/icons';

import { DEPOSIT_TOKENS, DEPOSIT_TOKEN_DECIMALS, DepositToken } from '@/types/constants';

import { CONTRACTS } from '@/lib/constants';
import { formatBigIntToReadable } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useAccountBalance } from '@/hooks/useAccountBalance';
import { checkHasEnoughAllowance } from '@/hooks/useAllowance';
import { useApproveSpending } from '@/hooks/useApproveSpending';
import { useDepositBalances } from '@/hooks/useDepositBalances';
import { useVault } from '@/hooks/useVault';

import ConnectedAccount from '@/components/connected-account';

import { useDepositAllowances } from './_hooks/useDepositAllowances';
import { useRouterDeposit } from './_hooks/useRouterDeposit';

export default function Deposit() {
  const isDesktop = useMediaQuery({ query: '(min-width: 1024px)' });

  const [depositToken, setDepositToken] = useState<DepositToken>('USDC');
  const [receive, setReceive] = useState<string | undefined>(undefined);

  const account = useAccount();

  const depositBalances = useDepositBalances();

  const vault = useVault();
  const zvltBalance = useAccountBalance({ address: CONTRACTS.zVLT });
  const allowances = useDepositAllowances();

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

  const deposit = form.watch('deposit');
  const depositRaw = deposit ? parseUnits(deposit, DEPOSIT_TOKEN_DECIMALS[depositToken]) : undefined;
  const hasDepositRaw = depositRaw !== undefined && depositRaw > 0n;
  const hasEnoughAllowance = checkHasEnoughAllowance({
    allowance: allowances.data?.[depositToken],
    amount: depositRaw
  });

  const approveSpending = useApproveSpending();
  const routerDeposit = useRouterDeposit();

  const isFetching = account.isPending || depositBalances.isFetching || zvltBalance.isFetching || allowances.isFetching;
  const isDisabled = account.isDisconnected || isFetching || approveSpending.isPending || routerDeposit.isPending;

  const handleDepositChange = (value: string) => {
    const receiveAmount = getReceiveAmount({
      deposit: value,
      totalSupply: vault.data?.totalSupply ?? 0n,
      totalAssets: vault.data?.totalAssets ?? 0n
    });

    setReceive(receiveAmount);
  };

  const handleDepositTokenChange = (value: DepositToken) => {
    setDepositToken(value);
    setReceive(undefined);
    form.setValue('deposit', undefined as any);
    form.clearErrors('deposit');
    form.setFocus('deposit');
  };

  const validateForm = () => form.trigger('deposit', { shouldFocus: true });

  const handleApprove = async () => {
    const isValid = await validateForm();
    if (!isValid) return;

    approveSpending.mutate({
      contract: CONTRACTS[depositToken],
      spender: CONTRACTS.zRTR,
      amount: depositRaw,
      name: depositToken
    });
  };

  const handleDeposit = async () => {
    const isValid = await validateForm();
    if (!isValid) return;

    routerDeposit.mutate(
      {
        stableCoinName: depositToken,
        amount: depositRaw
      },
      {
        onSuccess: () => {
          form.reset();
          setReceive(undefined);
        }
      }
    );
  };

  return (
    <div className="sticky top-14 hidden rounded-2xl bg-surface-elevated p-2 lg:block lg:min-w-[24.75rem] xl:min-w-[39.375rem]">
      <div className="p-4">
        <p className="text-h6 text-primary">Deposit & Earn</p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl bg-surface-base p-6 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
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
              isDisabled={isDisabled}
              decimalPlaces={DEPOSIT_TOKEN_DECIMALS[depositToken]}
              endContent={
                <div className="flex items-center">
                  <DepositMaxButton
                    token={depositToken}
                    setDepositAmount={(value) => {
                      onChange(value);
                      handleDepositChange(value);
                    }}
                    isDisabled={isDisabled}
                  />

                  <div className="ml-3">
                    {isDesktop ? (
                      <DepositTokenDialog
                        isDisabled={isDisabled}
                        selected={depositToken}
                        onSelectionChange={handleDepositTokenChange}
                      />
                    ) : (
                      <DepositTokenSelect
                        isDisabled={isDisabled}
                        selected={depositToken}
                        onSelectionChange={handleDepositTokenChange}
                      />
                    )}
                  </div>
                </div>
              }
            />
          )}
        />

        <Input
          isDisabled
          variant="amount"
          label="Receive"
          labelContent={<ZvltBalance />}
          labelClassName="h-5"
          value={receive ?? ''}
          onChange={(value) => {
            const parsedValue = parseInput(value);
            setReceive(parsedValue || undefined);
          }}
          decimalPlaces={18}
        />

        <ConnectedAccount>
          {isFetching ? (
            <Button fullWidth isPending={true} pendingContent="Loading..." />
          ) : !hasDepositRaw ? (
            <Button fullWidth onPress={handleDeposit}>
              Deposit
            </Button>
          ) : !hasEnoughAllowance ? (
            <Button
              fullWidth
              onPress={handleApprove}
              isPending={approveSpending.isPending}
              pendingContent={
                approveSpending.isTxPending
                  ? `Approving ${depositToken}...`
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
              onPress={handleDeposit}
              isPending={routerDeposit.isPending}
              pendingContent={
                routerDeposit.isTxPending
                  ? `Depositing ${depositToken}...`
                  : routerDeposit.isPending
                    ? `Signing Transaction...`
                    : undefined
              }
            >
              Deposit
            </Button>
          )}
        </ConnectedAccount>
      </div>
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
  frxUSD: <FrxUsdIcon />,
  zSTT: <ZsttIcon />
};

const DEPOSIT_TOKEN_NAME: Record<DepositToken, string> = {
  USDC: 'USD Coin',
  USDT: 'Tether USD',
  frxUSD: 'Frax USD',
  zSTT: 'Legacy token by Zivoe'
};

const DEPOSIT_TOKENS_SELECT_ITEMS = DEPOSIT_TOKENS.map((token) => ({
  id: token,
  label: token,
  name: DEPOSIT_TOKEN_NAME[token],
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
  const hasDepositBalance = depositBalances.data !== undefined && depositBalances.data[token] > 0n;

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

function DepositTokenDialog({
  selected,
  onSelectionChange,
  isDisabled
}: {
  selected: DepositToken;
  onSelectionChange: (value: DepositToken) => void;
  isDisabled: boolean;
}) {
  const depositBalances = useDepositBalances();
  const icon = DEPOSIT_TOKEN_ICON[selected];

  if (!icon) return null;

  return (
    <Dialog>
      <SelectTrigger className="w-[7.82rem] justify-between" isDisabled={isDisabled}>
        <div className="flex items-center gap-2 [&_svg]:size-6">
          {icon}
          {selected}
        </div>
      </SelectTrigger>

      <DialogContent dialogClassName="gap-0">
        {({ close }) => (
          <>
            <DialogHeader>
              <DialogTitle>Select Asset</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-2 rounded-2xl bg-surface-base p-4 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
              {DEPOSIT_TOKENS_SELECT_ITEMS.map((item) => (
                <Aria.Button
                  key={item.id}
                  onPress={() => {
                    onSelectionChange(item.id);
                    close();
                  }}
                  className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-3 outline-none hover:bg-surface-elevated focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-[1px] focus-visible:ring-offset-neutral-0"
                >
                  <div className="flex items-center gap-2 [&_svg]:size-8">
                    {item.icon}

                    <div className="flex flex-col items-start">
                      <p className="text-regular font-medium text-primary">{item.label}</p>
                      <p className="text-extraSmall text-tertiary">{item.name}</p>
                    </div>
                  </div>

                  <p className="text-small text-tertiary">
                    Balance:{' '}
                    <span className="font-medium text-primary">
                      {formatBigIntToReadable(depositBalances.data?.[item.id] ?? 0n, DEPOSIT_TOKEN_DECIMALS[item.id])}
                    </span>
                  </p>
                </Aria.Button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
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
    >
      <SelectTrigger className="w-[7.82rem] justify-between">
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
  const zvltBalance = useAccountBalance({ address: CONTRACTS.zVLT });
  if (zvltBalance.isPending || zvltBalance.data === undefined) return null;

  return <p className="text-small text-primary">Balance: {formatBigIntToReadable(zvltBalance.data)}</p>;
}
