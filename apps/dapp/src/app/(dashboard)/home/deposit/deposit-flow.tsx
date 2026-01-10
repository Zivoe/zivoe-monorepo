'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import * as Aria from 'react-aria-components';
import { Controller, useForm } from 'react-hook-form';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { CONTRACTS } from '@zivoe/contracts';
import { tetherTokenAbi, zivoeTrancheTokenAbi } from '@zivoe/contracts/abis';
import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Input } from '@zivoe/ui/core/input';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';

import { DEPOSIT_TOKENS, DEPOSIT_TOKEN_DECIMALS, DepositToken } from '@/types/constants';

import { customNumber, formatBigIntToReadable } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useAccountBalance } from '@/hooks/useAccountBalance';
import { checkHasEnoughAllowance } from '@/hooks/useAllowance';
import { ApproveTokenAbi, useApproveSpending } from '@/hooks/useApproveSpending';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useDepositBalances } from '@/hooks/useDepositBalances';
import { useVault } from '@/hooks/useVault';

import ConnectedAccount from '@/components/connected-account';
import { TOKEN_INFO } from '@/components/token-info';

import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { TokenDisplay } from './_components/token-display';
import { useDepositAllowances } from './_hooks/useDepositAllowances';
import { useRouterDeposit } from './_hooks/useRouterDeposit';
import { useRouterDepositPermit } from './_hooks/useRouterDepositPermit';
import { useVaultDeposit } from './_hooks/useVaultDeposit';
import { calculateZVLTDollarValue, createAmountValidator, parseInput } from './_utils';

type DepositForm = z.infer<z.ZodObject<{ deposit: ReturnType<typeof createAmountValidator> }>>;

export function DepositFlow({ apy }: { apy: number | null }) {
  const [depositToken, setDepositToken] = useState<DepositToken>('USDC');
  const [receive, setReceive] = useState<string | undefined>(undefined);

  const account = useAccount();
  const chainalysis = useChainalysis();

  const allowances = useDepositAllowances();
  const depositBalances = useDepositBalances();

  const zvltBalance = useAccountBalance({ address: CONTRACTS.zVLT });

  const vault = useVault();

  const form = useForm<DepositForm>({
    resolver: zodResolver(
      z.object({
        deposit: createAmountValidator({
          balance: depositBalances.data?.[depositToken] ?? 0n,
          decimals: DEPOSIT_TOKEN_DECIMALS[depositToken],
          requiredMessage: 'Deposit amount is required',
          exceedsMessage: 'Deposit amount exceeds balance'
        })
      })
    ),
    defaultValues: { deposit: undefined },
    mode: 'onChange'
  });

  const deposit = form.watch('deposit');
  const depositRaw = deposit ? parseUnits(deposit, DEPOSIT_TOKEN_DECIMALS[depositToken]) : undefined;
  const hasDepositRaw = depositRaw !== undefined && depositRaw > 0n;

  const zVLTDollarValue = calculateZVLTDollarValue({ amount: receive, indexPrice: vault.data?.indexPrice ?? null });

  const hasEnoughAllowance =
    depositToken === 'USDT' || depositToken === 'zSTT'
      ? checkHasEnoughAllowance({
          allowance: allowances.data?.[depositToken],
          amount: depositRaw
        })
      : true;

  const approveSpending = useApproveSpending();

  const routerDeposit = useRouterDeposit();
  const permitDeposit = useRouterDepositPermit();
  const vaultDeposit = useVaultDeposit();

  const isFetching =
    account.isPending ||
    depositBalances.isFetching ||
    zvltBalance.isFetching ||
    allowances.isFetching ||
    chainalysis.isFetching;

  const isDisabled =
    isFetching ||
    approveSpending.isPending ||
    routerDeposit.isPending ||
    permitDeposit.isPending ||
    vaultDeposit.isPending;

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

  const handleApprove = async ({ approveToken }: { approveToken: Extract<DepositToken, 'USDT' | 'zSTT'> }) => {
    const isValid = await validateForm();
    if (!isValid) return;

    approveSpending.mutate({
      contract: CONTRACTS[approveToken],
      spender: approveToken === 'USDT' ? CONTRACTS.zRTR : CONTRACTS.zVLT,
      amount: depositRaw,
      name: approveToken,
      abi: APPROVE_TOKEN_ABI[approveToken],
      successMessage: `You can now deposit ${approveToken}`,
      errorMessage: `There was an error approving ${approveToken}`
    });
  };

  const handleDepositSuccess = () => {
    form.reset();
    setReceive(undefined);
  };

  const handleDeposit = async ({ token }: { token: DepositToken }) => {
    const isValid = await validateForm();
    if (!isValid) return;

    if (token === 'USDT')
      routerDeposit.mutate({ stableCoinName: token, amount: depositRaw }, { onSuccess: handleDepositSuccess });

    if (token === 'USDC' || token === 'frxUSD')
      permitDeposit.mutate({ stableCoinName: token, amount: depositRaw }, { onSuccess: handleDepositSuccess });

    if (token === 'zSTT')
      vaultDeposit.mutate({ stableCoinName: token, amount: depositRaw }, { onSuccess: handleDepositSuccess });
  };

  useEffect(() => {
    const zSttBalance = depositBalances.data?.[depositToken];
    if (zSttBalance === 0n && depositToken === 'zSTT') handleDepositTokenChange('USDC');
  }, [depositBalances.data, depositToken]);

  useEffect(() => {
    if (!account.address) handleDepositTokenChange('USDC');
    else form.clearErrors();
  }, [account.address]);

  return (
    <>
      <Controller
        control={form.control}
        name="deposit"
        render={({ field: { value, onChange, ...field }, fieldState: { error, invalid } }) => (
          <Input
            {...field}
            inputMode="decimal"
            variant="amount"
            label="Deposit"
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
            subContent={
              <InputExtraInfo
                decimals={DEPOSIT_TOKEN_DECIMALS[depositToken]}
                dollarValue={depositRaw ?? 0n}
                balance={{ value: depositBalances.data?.[depositToken], isPending: depositBalances.isPending }}
              />
            }
            endContent={
              <div className="flex items-center">
                <MaxButton
                  balance={depositBalances.data?.[depositToken] ?? 0n}
                  decimals={DEPOSIT_TOKEN_DECIMALS[depositToken]}
                  onPress={(value) => {
                    onChange(value);
                    handleDepositChange(value);
                  }}
                  isDisabled={isDisabled}
                />

                <div className="ml-3">
                  <>
                    <DepositTokenDialog
                      isDisabled={isDisabled}
                      selected={depositToken}
                      onSelectionChange={handleDepositTokenChange}
                    />

                    <DepositTokenSelect
                      selected={depositToken}
                      onSelectionChange={handleDepositTokenChange}
                      isDisabled={isDisabled}
                    />
                  </>
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
            dollarValue={zVLTDollarValue}
            balance={{ value: zvltBalance.data, isPending: zvltBalance.isPending }}
          />
        }
        endContent={<TokenDisplay symbol="zVLT" />}
      />

      <ConnectedAccount>
        {isFetching ? (
          <Button fullWidth isPending={true} pendingContent="Loading..." />
        ) : !hasDepositRaw ? (
          <Button fullWidth onPress={() => handleDeposit({ token: depositToken })}>
            Deposit
          </Button>
        ) : depositToken === 'USDT' || depositToken === 'zSTT' ? (
          !hasEnoughAllowance ? (
            <Button
              fullWidth
              onPress={() => handleApprove({ approveToken: depositToken })}
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
          ) : depositToken === 'USDT' ? (
            <Button
              fullWidth
              onPress={() => handleDeposit({ token: depositToken })}
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
          ) : depositToken === 'zSTT' ? (
            <Button
              fullWidth
              onPress={() => handleDeposit({ token: depositToken })}
              isPending={vaultDeposit.isPending}
              pendingContent={
                vaultDeposit.isTxPending
                  ? `Depositing ${depositToken}...`
                  : vaultDeposit.isPending
                    ? `Signing Transaction...`
                    : undefined
              }
            >
              Deposit
            </Button>
          ) : null
        ) : depositToken === 'USDC' || depositToken === 'frxUSD' ? (
          <Button
            fullWidth
            onPress={() => handleDeposit({ token: depositToken })}
            isPending={permitDeposit.isPending}
            pendingContent={
              permitDeposit.isPermitPending
                ? `Signing Permit...`
                : permitDeposit.isTxPending
                  ? `Depositing ${depositToken}...`
                  : permitDeposit.isPending
                    ? `Signing Transaction...`
                    : undefined
            }
          >
            Deposit
          </Button>
        ) : null}
      </ConnectedAccount>

      {receive && apy !== null && deposit ? <EstimatedAnnualReturn depositAmount={deposit} apy={apy} /> : null}
    </>
  );
}

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

const DEPOSIT_TOKENS_SELECT_ITEMS = DEPOSIT_TOKENS.map((token) => {
  const info = TOKEN_INFO[token];

  return {
    id: token,
    label: info.label,
    name: info.description,
    icon: info.icon
  };
});

function DepositTokenDialog({
  selected,
  onSelectionChange,
  isDisabled
}: {
  selected: DepositToken;
  onSelectionChange: (value: DepositToken) => void;
  isDisabled: boolean;
}) {
  const account = useAccount();
  const depositBalances = useDepositBalances();

  const icon = TOKEN_INFO[selected].icon;
  if (!icon) return null;

  const selectItems = getFilteredSelectItems(depositBalances.data);

  return (
    <Dialog>
      <SelectTrigger
        variant="border-light"
        className="hidden w-[7.4375rem] justify-between gap-2 lg:flex"
        isDisabled={isDisabled}
      >
        <div className="flex items-center gap-2 [&_svg]:size-4">
          {icon}
          {selected}
        </div>
      </SelectTrigger>

      <DialogContent dialogClassName="gap-0" showCloseButton={false}>
        {({ close }) => (
          <>
            <DialogHeader>
              <DialogTitle>Select Asset</DialogTitle>
            </DialogHeader>

            <DialogContentBox className="gap-2 p-4">
              {selectItems.map((item) => (
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

                  {account.address && (
                    <p className="text-small text-tertiary">
                      Balance:{' '}
                      <span className="font-medium text-primary">
                        {formatBigIntToReadable(depositBalances.data?.[item.id] ?? 0n, DEPOSIT_TOKEN_DECIMALS[item.id])}
                      </span>
                    </p>
                  )}
                </Aria.Button>
              ))}
            </DialogContentBox>
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
  const depositBalances = useDepositBalances();
  const selectItems = getFilteredSelectItems(depositBalances.data);

  return (
    <Select
      placeholder="Select"
      aria-label="Select a chart view"
      value={selected}
      onChange={(value) => onSelectionChange(value as DepositToken)}
      isDisabled={isDisabled}
    >
      <SelectTrigger variant="border-light" className="w-[7.4375rem] justify-between gap-2 lg:hidden">
        <SelectValue className="flex items-center gap-2 [&_svg]:size-4" />
      </SelectTrigger>

      <SelectPopover>
        <SelectListBox items={selectItems}>
          {(item) => (
            <SelectItem
              key={item.id}
              value={item}
              textValue={item.label}
              className="flex items-center gap-2 [&_svg]:size-5"
              showCheckmark={false}
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

const getFilteredSelectItems = (depositBalances: Record<DepositToken, bigint> | undefined) => {
  return DEPOSIT_TOKENS_SELECT_ITEMS.filter((item) => item.id !== 'zSTT' || (depositBalances?.[item.id] ?? 0n) > 0n);
};

function EstimatedAnnualReturn({ depositAmount, apy }: { depositAmount: string; apy: number }) {
  let valueFormatted = '-';
  const depositAmountNumber = Number(depositAmount);

  if (depositAmountNumber !== 0) {
    const value = (apy / 100) * depositAmountNumber;
    valueFormatted = customNumber(value);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-default bg-surface-elevated p-6">
      <p className="text-regular text-secondary">Estimated Annual Return</p>
      <p className="text-h6 text-primary">
        {valueFormatted === '-' ? '-' : `$${valueFormatted === '0.00' ? '<0.01' : valueFormatted}`}
      </p>
    </div>
  );
}

const APPROVE_TOKEN_ABI: Record<Extract<DepositToken, 'USDT' | 'zSTT'>, ApproveTokenAbi> = {
  USDT: tetherTokenAbi,
  zSTT: zivoeTrancheTokenAbi
};
