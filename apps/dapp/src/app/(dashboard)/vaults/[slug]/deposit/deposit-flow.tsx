'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Input } from '@zivoe/ui/core/input';
import { Skeleton } from '@zivoe/ui/core/skeleton';

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
  type TransactionIdentity,
  isPriceUnavailableError,
  useCentrifugeVaultCapacity,
  useDeposit,
  useDepositPreview,
  useInvestorWhitelist
} from '@/centrifuge';

import { useZivoeVaultStatus } from '../zivoe-vault-provider';
import { ChainBalanceDetail } from './_components/chain-balance-detail';
import { SwitchChainButton, useSelectedChain } from './_components/chain-switch';
import { ChainTokenSelector } from './_components/chain-token-selector';
import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { NotWhitelistedCallout } from './_components/not-whitelisted-callout';
import { TokenDisplay } from './_components/token-display';
import { useEarnDialog } from './_hooks/earn-dialog';
import { createAmountValidator, parseInput } from './_utils';

type DepositForm = { deposit: string };

export function DepositFlow() {
  const {
    identities,
    selectedIdentity: identity,
    selectedChain,
    setSelectedChain,
    needsChainSwitch
  } = useSelectedChain();

  const { centrifugeVault } = identity;
  const share = centrifugeVault.shareClass;
  const { usdc, vaultRouterAddress } = centrifugeVault;

  const account = useAccount();
  const chainalysis = useChainalysis();
  const { setIsOpen: setIsEarnDialogOpen } = useEarnDialog();

  // A deploying Zivoe Vault does not take new deposits; its redemptions stay open.
  const isZivoeVaultDeploying = useZivoeVaultStatus() === 'Deploying';

  const usdcBalance = useBalance({ chain: selectedChain, tokenAddress: usdc.address });
  const shareBalance = useBalance({ chain: selectedChain, tokenAddress: share.shareTokenAddress });
  const allowance = useAllowance({ chain: selectedChain, contract: usdc.address, spender: vaultRouterAddress });
  const capacity = useCentrifugeVaultCapacity({ centrifugeVault });
  const whitelist = useInvestorWhitelist({ centrifugeVault });

  // Only a definitive `false` gates anything. A failed read is a fetch problem
  // and not a verdict about this wallet, so it leaves the flow alone and lets
  // the pre-sign simulation decode the real revert if the Centrifuge vault does refuse.
  const isNotWhitelisted = whitelist.isSuccess && !whitelist.data.canReceiveShares;

  const balance = usdcBalance.data ?? 0n;
  const maxDeposit = capacity.data?.maxDeposit;
  const isCapacityUnavailable = capacity.isSuccess && capacity.data.maxDeposit <= 0n;

  const form = useForm<DepositForm>({
    resolver: zodResolver(
      z.object({
        deposit: createAmountValidator({
          balance,
          decimals: usdc.decimals,
          requiredMessage: 'Deposit amount is required',
          exceedsMessage: 'Deposit amount exceeds balance',
          max: { value: maxDeposit, message: 'Deposit amount exceeds current vault capacity.' }
        })
      })
    ),
    defaultValues: { deposit: undefined },
    mode: 'onChange'
  });

  const deposit = form.watch('deposit');
  const depositRaw = deposit ? parseUnits(deposit, usdc.decimals) : undefined;
  const hasDepositRaw = depositRaw !== undefined && depositRaw > 0n;

  // Debounced indicative preview: any raw change immediately drops the previous
  // quote (the query key follows the debounced amount) and only the latest
  // amount's successful response renders.
  const { debouncedValue: debouncedDeposit, isDebouncing } = useDebouncedValue({ value: deposit });
  const debouncedRaw = debouncedDeposit ? parseUnits(debouncedDeposit, usdc.decimals) : undefined;
  const preview = useDepositPreview({ centrifugeVault, assets: debouncedRaw ?? 0n });

  const isPreviewCurrent = !isDebouncing && debouncedRaw === depositRaw;
  const previewShares = hasDepositRaw && isPreviewCurrent ? preview.data?.shares : undefined;
  // A retry in flight drops back into the loading presentation (skeleton +
  // pending action) instead of keeping the stale error on screen.
  const isPreviewFailed = hasDepositRaw && isPreviewCurrent && preview.isError && !preview.isFetching;
  const isPreviewLoading = hasDepositRaw && !isPreviewFailed && previewShares === undefined;

  const isPriceUnavailable = isPreviewFailed && isPriceUnavailableError(preview.error);

  const hasEnoughAllowance = checkHasEnoughAllowance({ allowance: allowance.data, amount: depositRaw });

  const approveSpending = useApproveSpending({ zivoeVaultSlug: identity.zivoeVaultSlug });
  const depositMutation = useDeposit({ identity, onSuccessClose: () => setIsEarnDialogOpen(false) });

  // Balances/allowance use isFetching so post-transaction invalidations keep
  // the form locked until fresh data lands.
  const isPrereqsLoading =
    account.isPending ||
    usdcBalance.isFetching ||
    shareBalance.isFetching ||
    allowance.isFetching ||
    chainalysis.isFetching ||
    whitelist.isFetching ||
    // isPending on purpose: capacity refetches on a 5-minute interval, and
    // isFetching would flash the whole form to loading on every refresh.
    capacity.isPending;

  // The two blocks differ in what they say about the future. A resolving or
  // failed preview may still clear on its own, so it only gates the action
  // (isSubmitBlocked) and leaves the inputs editable — typing an amount while
  // it clears is reasonable. A deploying Zivoe Vault, a Centrifuge vault with no capacity
  // and a wallet the Centrifuge vault will not admit are settled answers, so they lock
  // the form itself: there is no amount worth entering.
  const isFormLocked =
    isPrereqsLoading ||
    approveSpending.isPending ||
    depositMutation.isPending ||
    isZivoeVaultDeploying ||
    isCapacityUnavailable ||
    isNotWhitelisted;

  // The chain selector must NOT inherit the per-chain verdicts (capacity,
  // whitelist): they are exactly what switching chains escapes, and freezing
  // the selector on them would trap the user on the failing chain. Same
  // gating as the redeem tab's selector.
  const isChainSelectorLocked = isPrereqsLoading || approveSpending.isPending || depositMutation.isPending;

  // Only the quote gates the action. The settled facts above are enforced one
  // level up, where the ladder swaps this button for a named one — repeating
  // them here would describe states this gate never sees.
  const isSubmitBlocked = isPreviewLoading || isPreviewFailed;

  const maxAmount = maxDeposit !== undefined && maxDeposit < balance ? maxDeposit : balance;

  // The balance and capacity rules are wallet- and chain-scoped, so a verdict
  // about the previous wallet or chain outlives it — 'exceeds balance' would
  // sit on a context that can afford the amount until the next keystroke
  // revalidates.
  useEffect(() => {
    if (account.address) form.clearErrors();
  }, [account.address, selectedChain, form]);

  const validateForm = () => form.trigger('deposit', { shouldFocus: true });

  const handleApprove = async () => {
    const isValid = await validateForm();
    if (!isValid || isSubmitBlocked) return;

    approveSpending.mutate({
      chain: selectedChain,
      contract: usdc.address,
      spender: vaultRouterAddress,
      amount: depositRaw,
      name: 'USDC',
      decimals: usdc.decimals,
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

    depositMutation.mutate(
      { assets: depositRaw, previewShares },
      // A reverted receipt also resolves as mutation success (it routes to the
      // failure dialog) — keep the entered amount so the user can retry as-is.
      { onSuccess: ({ receipt }) => receipt.status === 'success' && form.reset({ deposit: undefined }) }
    );
  };

  const receiveValue = previewShares !== undefined ? formatUnits(previewShares, share.decimals) : '';
  // Suppress the amount input's `0.0` ghost while the estimate is loading —
  // it would otherwise read as "you receive 0.0" next to the skeleton.
  const receivePlaceholder = isPreviewLoading ? '' : undefined;
  // The quote is at the current Share Price, so the estimated receive's dollar
  // value equals the entered USDC amount. A failed estimate resolves it here
  // rather than at the row, matching the redeem tab.
  const receiveDollarValue = isPreviewFailed
    ? 0n
    : previewShares !== undefined && depositRaw !== undefined
      ? depositRaw
      : deposit
        ? null
        : 0n;

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
            errorMessage={error?.message}
            isInvalid={invalid}
            isDisabled={isFormLocked}
            decimalPlaces={usdc.decimals}
            subContent={
              <InputExtraInfo
                dollarValueDecimals={usdc.decimals}
                dollarValue={depositRaw ?? 0n}
                balance={{ value: usdcBalance.data, isPending: usdcBalance.isPending, decimals: usdc.decimals }}
              />
            }
            endContent={
              <div className="flex items-center">
                <MaxButton
                  balance={maxAmount}
                  decimals={usdc.decimals}
                  onPress={(value) => onChange(value)}
                  isDisabled={isFormLocked}
                />

                <div className="ml-3">
                  <ChainTokenSelector
                    title="Select Asset"
                    token={TOKEN_INFO.USDC}
                    rows={identities.map((rowIdentity) => ({
                      chain: rowIdentity.centrifugeVault.chain,
                      detail: <ChainBalanceDetail identity={rowIdentity} token="usdc" />
                    }))}
                    selectedChain={selectedChain}
                    onSelect={setSelectedChain}
                    isDisabled={isChainSelectorLocked}
                  />
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
              {isPriceUnavailable ? 'Deposits are currently unavailable.' : `Unable to estimate ${share.symbol}.`}{' '}
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
            dollarValueDecimals={usdc.decimals}
            dollarValue={receiveDollarValue}
            isLoading={isPreviewLoading}
            balance={{ value: shareBalance.data, isPending: shareBalance.isPending, decimals: share.decimals }}
          />
        }
        endContent={<TokenDisplay symbol={share.symbol} />}
      />

      {/* Outside ConnectedAccount on purpose: a deploying Zivoe Vault and a Centrifuge vault
          with no capacity are both decided without reference to any wallet, so
          prompting for one would only offer a connection that leads nowhere. */}
      {isZivoeVaultDeploying ? (
        <Button fullWidth isDisabled>
          Deposits Disabled
        </Button>
      ) : isCapacityUnavailable ? (
        <Button fullWidth isDisabled>
          Deposits Unavailable
        </Button>
      ) : (
        <ConnectedAccount>
          {needsChainSwitch ? (
            <SwitchChainButton />
          ) : isPrereqsLoading ? (
            <Button fullWidth isPending={true} pendingContent="Loading..." />
          ) : isNotWhitelisted ? (
            <Button fullWidth isDisabled>
              Wallet Not Whitelisted
            </Button>
          ) : hasDepositRaw && !hasEnoughAllowance ? (
            <Button
              fullWidth
              onPress={() => void handleApprove()}
              isDisabled={isSubmitBlocked}
              isPending={approveSpending.isPending || isPreviewLoading}
              pendingContent={
                isPreviewLoading
                  ? `Estimating ${share.symbol}...`
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
              isDisabled={isSubmitBlocked}
              isPending={depositMutation.isPending || isPreviewLoading}
              pendingContent={
                isPreviewLoading
                  ? `Estimating ${share.symbol}...`
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
      )}

      {/* Why the action above is disabled. The deploying status and the Centrifuge vault's
          capacity are Zivoe Vault facts, so they render whether or not a wallet is
          connected; the whitelist verdict only exists once one is. */}
      {isZivoeVaultDeploying ? (
        <Callout variant="warning">Deposits are currently disabled, redemptions are enabled.</Callout>
      ) : isCapacityUnavailable ? (
        <Callout variant="warning">Deposits are currently unavailable, redemptions are enabled.</Callout>
      ) : isNotWhitelisted ? (
        <NotWhitelistedCallout />
      ) : null}

      {/* TODO: restore the illustrative annualized return once we publish an
          APY to project it from. */}
      {/* {depositRaw ? <EstimatedAnnualizedReturn assets={depositRaw} apy={apy} /> : null} */}
    </>
  );
}
