'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSetAtom } from 'jotai';
import * as Aria from 'react-aria-components';
import { Controller, useForm } from 'react-hook-form';
import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Input } from '@zivoe/ui/core/input';
import { Select, SelectItem, SelectListBox, SelectPopover, SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { Skeleton } from '@zivoe/ui/core/skeleton';

import { createTransactionProperties } from '@/lib/analytics/events';
import { useAnalytics } from '@/lib/analytics/use-analytics';
import { depositDialogAtom } from '@/lib/store';
import { formatBigIntToReadable } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { checkHasEnoughAllowance, useAllowance } from '@/hooks/useAllowance';
import { useApproveSpending } from '@/hooks/useApproveSpending';
import { useBalance } from '@/hooks/useBalance';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

import ConnectedAccount from '@/components/connected-account';
import { TOKEN_INFO } from '@/components/token-info';

import {
  CENTRIFUGE_CONFIG,
  isPriceUnavailableError,
  useDeposit,
  useDepositPreview,
  useVaultCapacity
} from '@/centrifuge';

import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { TokenDisplay } from './_components/token-display';
import { parseInput } from './_utils';

const USDC = CENTRIFUGE_CONFIG.usdc;
const ZMCA = CENTRIFUGE_CONFIG.shareToken;

type DepositForm = { deposit: string };

export function DepositFlow() {
  const account = useAccount();
  const analytics = useAnalytics();
  const chainalysis = useChainalysis();
  const setIsDepositDialogOpen = useSetAtom(depositDialogAtom);

  const usdcBalance = useBalance({ tokenAddress: USDC.address });
  const zMcaBalance = useBalance({ tokenAddress: ZMCA.address });
  const allowance = useAllowance({ contract: USDC.address, spender: CENTRIFUGE_CONFIG.vaultRouterAddress });
  const capacity = useVaultCapacity();

  const balance = usdcBalance.data ?? 0n;
  const maxDeposit = capacity.data?.maxDeposit;
  const isCapacityUnavailable = capacity.isSuccess && capacity.data.maxDeposit <= 0n;

  const form = useForm<DepositForm>({
    resolver: zodResolver(z.object({ deposit: createDepositAmountValidator({ balance, capacity: maxDeposit }) })),
    defaultValues: { deposit: undefined },
    mode: 'onChange'
  });

  const deposit = form.watch('deposit');
  const depositRaw = deposit ? parseUnits(deposit, USDC.decimals) : undefined;
  const hasDepositRaw = depositRaw !== undefined && depositRaw > 0n;

  // Debounced indicative preview: any raw change immediately drops the previous
  // quote (the query key follows the debounced amount) and only the latest
  // amount's successful response renders.
  const { debouncedValue: debouncedDeposit, isDebouncing } = useDebouncedValue({ value: deposit });
  const debouncedRaw = debouncedDeposit ? parseUnits(debouncedDeposit, USDC.decimals) : undefined;
  const preview = useDepositPreview({ assets: debouncedRaw ?? 0n });

  const isPreviewCurrent = !isDebouncing && debouncedRaw === depositRaw;
  const previewShares = hasDepositRaw && isPreviewCurrent ? preview.data?.shares : undefined;
  // A retry in flight drops back into the loading presentation (skeleton +
  // pending action) instead of keeping the stale error on screen.
  const isPreviewFailed = hasDepositRaw && isPreviewCurrent && preview.isError && !preview.isFetching;
  const isPreviewLoading = hasDepositRaw && !isPreviewFailed && previewShares === undefined;

  const isPriceUnavailable = isPreviewFailed && isPriceUnavailableError(preview.error);

  const hasEnoughAllowance = checkHasEnoughAllowance({ allowance: allowance.data, amount: depositRaw });

  const approveSpending = useApproveSpending();
  const depositMutation = useDeposit({ onSuccessClose: () => setIsDepositDialogOpen(false) });

  // Balances/allowance use isFetching so post-transaction invalidations keep
  // the form locked until fresh data lands.
  const isPrereqsLoading =
    account.isPending ||
    usdcBalance.isFetching ||
    zMcaBalance.isFetching ||
    allowance.isFetching ||
    chainalysis.isFetching ||
    // isPending on purpose: capacity refetches on a 5-minute interval, and
    // isFetching would flash the whole form to loading on every refresh.
    capacity.isPending;

  // isSubmitBlocked only gates approve/deposit, so inputs stay editable while
  // a preview resolves or the vault is at capacity.
  const isFormLocked = isPrereqsLoading || approveSpending.isPending || depositMutation.isPending;
  const isSubmitBlocked = isPreviewLoading || isPreviewFailed || isCapacityUnavailable;

  const maxAmount = maxDeposit !== undefined && maxDeposit < balance ? maxDeposit : balance;

  const validateForm = () => form.trigger('deposit', { shouldFocus: true });

  const handleApprove = async () => {
    const isValid = await validateForm();
    if (!isValid || isSubmitBlocked) return;

    approveSpending.mutate({
      contract: USDC.address,
      spender: CENTRIFUGE_CONFIG.vaultRouterAddress,
      amount: depositRaw,
      name: 'USDC',
      abi: erc20Abi,
      successMessage: 'You can now deposit USDC.',
      errorMessage: 'There was an error approving USDC'
    });
  };

  const handleDeposit = async () => {
    const isValid = await validateForm();
    if (!isValid || isSubmitBlocked) return;
    // Narrowing only — validation guarantees depositRaw and isSubmitBlocked
    // covers every missing-preview state.
    if (!depositRaw || previewShares === undefined) return;

    analytics.capture(
      'tx:deposit_started',
      createTransactionProperties({
        flow: 'deposit',
        step: 'started',
        walletAddress: account.address,
        chainId: CENTRIFUGE_CONFIG.chainId,
        tokenIn: 'USDC',
        tokenOut: 'zMCA',
        amountInRaw: depositRaw,
        amountOutRaw: previewShares
      })
    );

    depositMutation.mutate(
      { assets: depositRaw, previewShares },
      // A reverted receipt also resolves as mutation success (it routes to the
      // failure dialog) — keep the entered amount so the user can retry as-is.
      { onSuccess: ({ receipt }) => receipt.status === 'success' && form.reset({ deposit: undefined }) }
    );
  };

  const receiveValue = previewShares !== undefined ? formatUnits(previewShares, ZMCA.decimals) : '';
  // Suppress the amount input's `0.0` ghost while the estimate is loading —
  // it would otherwise read as "you receive 0.0" next to the skeleton.
  const receivePlaceholder = isPreviewLoading ? '' : undefined;
  // The quote is at the current Share Price, so the estimated receive's dollar
  // value equals the entered USDC amount.
  const receiveDollarValue = previewShares !== undefined && depositRaw !== undefined ? depositRaw : deposit ? null : 0n;

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
            value={value ?? ''}
            onChange={(value) => onChange(parseInput(value) || undefined)}
            errorMessage={isCapacityUnavailable ? 'Deposits are currently unavailable.' : error?.message}
            isInvalid={isCapacityUnavailable || invalid}
            isDisabled={isFormLocked}
            decimalPlaces={USDC.decimals}
            subContent={
              <InputExtraInfo
                decimals={USDC.decimals}
                dollarValue={depositRaw ?? 0n}
                balance={{ value: usdcBalance.data, isPending: usdcBalance.isPending }}
              />
            }
            endContent={
              <div className="flex items-center">
                <MaxButton
                  balance={maxAmount}
                  decimals={USDC.decimals}
                  onPress={(value) => onChange(value)}
                  isDisabled={isFormLocked}
                />

                <div className="ml-3">
                  <UsdcTokenDialog isDisabled={isFormLocked} />
                  <UsdcTokenSelect isDisabled={isFormLocked} />
                </div>
              </div>
            }
          />
        )}
      />

      <Input
        variant="amount"
        label="Estimated receive"
        value={receiveValue}
        placeholder={receivePlaceholder}
        isDisabled
        hasNormalStyleIfDisabled={!isFormLocked}
        errorMessage={
          isPreviewFailed ? (
            <>
              {isPriceUnavailable ? 'Deposits are currently unavailable.' : 'Unable to estimate zMCA.'}{' '}
              <Button variant="link-alert" size="s" onPress={() => void preview.refetch()}>
                Retry
              </Button>
            </>
          ) : undefined
        }
        isInvalid={isPreviewFailed}
        startContent={isPreviewLoading ? <Skeleton className="h-6 w-24" /> : undefined}
        subContent={
          <InputExtraInfo
            decimals={USDC.decimals}
            dollarValue={isPreviewFailed ? 0n : receiveDollarValue}
            isLoading={isPreviewLoading}
            balance={{ value: zMcaBalance.data, isPending: zMcaBalance.isPending, decimals: ZMCA.decimals }}
          />
        }
        endContent={<TokenDisplay symbol="zMCA" />}
      />

      <ConnectedAccount>
        {isPrereqsLoading ? (
          <Button fullWidth isPending={true} pendingContent="Loading..." />
        ) : hasDepositRaw && !hasEnoughAllowance ? (
          <Button
            fullWidth
            onPress={() => void handleApprove()}
            isDisabled={isSubmitBlocked}
            isPending={approveSpending.isPending || isPreviewLoading}
            pendingContent={
              isPreviewLoading
                ? 'Estimating zMCA...'
                : approveSpending.isTxPending
                  ? 'Approving USDC...'
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
            onPress={() => void handleDeposit()}
            isDisabled={hasDepositRaw && isSubmitBlocked}
            isPending={depositMutation.isPending || isPreviewLoading}
            pendingContent={
              isPreviewLoading
                ? 'Estimating zMCA...'
                : depositMutation.isTxPending
                  ? 'Depositing USDC...'
                  : depositMutation.isPending
                    ? 'Signing Transaction...'
                    : undefined
            }
          >
            Deposit
          </Button>
        )}
      </ConnectedAccount>

      {/* TODO: restore the illustrative annualized return once we publish an
          APY to project it from. */}
      {/* {depositRaw ? <EstimatedAnnualizedReturn assets={depositRaw} apy={apy} /> : null} */}
    </>
  );
}

const createDepositAmountValidator = ({ balance, capacity }: { balance: bigint; capacity: bigint | undefined }) => {
  return z.string({ required_error: 'Deposit amount is required' }).superRefine((amount, ctx) => {
    const parsedAmount = parseUnits(amount, USDC.decimals);

    if (parsedAmount === 0n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deposit amount is required' });
    }

    if (parsedAmount > balance) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deposit amount exceeds balance' });
    }

    if (capacity !== undefined && parsedAmount > capacity) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deposit amount exceeds current vault capacity.' });
    }
  });
};

// USDC is the only input asset, but the selector stays as the interaction point
// for future input assets. Everything else remains explicitly USDC-only.
const USDC_SELECT_ITEM = {
  id: 'USDC' as const,
  label: TOKEN_INFO.USDC.label,
  name: TOKEN_INFO.USDC.description,
  icon: TOKEN_INFO.USDC.icon
};

function UsdcTokenDialog({ isDisabled }: { isDisabled: boolean }) {
  const account = useAccount();
  const usdcBalance = useBalance({ tokenAddress: USDC.address });

  return (
    <Dialog>
      <SelectTrigger
        variant="border-light"
        className="hidden w-29.75 justify-between gap-2 lg:flex"
        isDisabled={isDisabled}
      >
        <div className="flex items-center gap-2 [&_svg]:size-4">
          {USDC_SELECT_ITEM.icon}
          {USDC_SELECT_ITEM.label}
        </div>
      </SelectTrigger>

      <DialogContent dialogClassName="gap-0" showCloseButton={false}>
        {({ close }) => (
          <>
            <DialogHeader>
              <DialogTitle>Select Asset</DialogTitle>
            </DialogHeader>

            <DialogContentBox className="gap-2 p-4">
              <Aria.Button
                onPress={close}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-3 outline-hidden hover:bg-surface-elevated focus:outline-hidden focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-0 focus-visible:outline-hidden"
              >
                <div className="flex items-center gap-2 [&_svg]:size-8">
                  {USDC_SELECT_ITEM.icon}

                  <div className="flex flex-col items-start">
                    <p className="text-regular font-medium text-primary">{USDC_SELECT_ITEM.label}</p>
                    <p className="text-extraSmall text-tertiary">{USDC_SELECT_ITEM.name}</p>
                  </div>
                </div>

                {account.address && (
                  <p className="text-small text-tertiary">
                    Balance:{' '}
                    <span className="font-medium text-primary">
                      {formatBigIntToReadable(usdcBalance.data ?? 0n, USDC.decimals)}
                    </span>
                  </p>
                )}
              </Aria.Button>
            </DialogContentBox>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UsdcTokenSelect({ isDisabled }: { isDisabled: boolean }) {
  return (
    <Select placeholder="Select" aria-label="Select deposit asset" value="USDC" isDisabled={isDisabled}>
      <SelectTrigger variant="border-light" className="w-29.75 justify-between gap-2 lg:hidden">
        <SelectValue className="flex items-center gap-2 [&_svg]:size-4" />
      </SelectTrigger>

      <SelectPopover>
        <SelectListBox items={[USDC_SELECT_ITEM]}>
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

// TODO: restore alongside the card above once we publish an APY to project
// from. The copy below still cites trailing 30-day performance and will need
// rewording for whatever rate replaces it.
// function EstimatedAnnualizedReturn({ assets, apy }: { assets: bigint; apy: number | null }) {
//   let valueFormatted: string | null = null;
//
//   if (apy !== null && assets > 0n) {
//     // apy is a percent (e.g. 7.31); basis points keep the bigint math exact.
//     const apyBps = BigInt(Math.round(apy * 100));
//     const value = (assets * apyBps) / 10_000n;
//
//     valueFormatted = formatBigIntWithCommas({
//       value,
//       tokenDecimals: USDC.decimals,
//       displayDecimals: 2,
//       showUnderZero: true
//     });
//   }
//
//   return (
//     <div className="flex flex-col gap-3 rounded-md border border-default bg-surface-elevated p-6">
//       <p className="text-regular text-secondary">Illustrative annualized return</p>
//       <p className="text-h6 text-primary">{valueFormatted === null ? '-' : `$${valueFormatted}`}</p>
//       <p className="text-extraSmall text-tertiary">Based on trailing 30-day performance; actual returns may differ.</p>
//     </div>
//   );
// }
