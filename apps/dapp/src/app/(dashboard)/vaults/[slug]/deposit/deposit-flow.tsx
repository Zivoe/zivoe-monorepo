'use client';

import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Input } from '@zivoe/ui/core/input';
import { Skeleton } from '@zivoe/ui/core/skeleton';

import { useAccount } from '@/hooks/useAccount';
import { checkHasEnoughAllowance, useAllowance } from '@/hooks/useAllowance';
import { useApproveSpending } from '@/hooks/useApproveSpending';
import { useBalance } from '@/hooks/useBalance';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { OTHER_WRITE_PENDING_LABEL, useIsAnyTxPending } from '@/hooks/useIsAnyTxPending';

import ConnectedAccount from '@/components/connected-account';

import {
  isPriceUnavailableError,
  useCentrifugeVaultCapacity,
  useDeposit,
  useDepositPreview,
  useInvestorAccess
} from '@/centrifuge';

import { useZivoeVaultStatus } from '../zivoe-vault-provider';
import { SwitchChainButton, useSelectedIdentity } from './_components/chain-switch';
import { DepositAssetPicker } from './_components/deposit-asset-picker';
import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { TokenDisplay } from './_components/token-display';
import { WalletAccessCallout } from './_components/wallet-access-callout';
import { useEarnDialog } from './_hooks/earn-dialog';
import { createAmountValidator, parseInput } from './_utils';

type DepositForm = { deposit: string };

export function DepositFlow() {
  const {
    identities,
    selectedIdentity: identity,
    selectedChain,
    setSelectedIdentity,
    needsChainSwitch
  } = useSelectedIdentity({ tab: 'deposit' });

  const { centrifugeVault } = identity;
  const share = centrifugeVault.shareClass;
  const { asset, vaultRouterAddress } = centrifugeVault;

  const account = useAccount();
  const chainalysis = useChainalysis();
  const { setIsOpen: setIsEarnDialogOpen } = useEarnDialog();

  // A deploying Zivoe Vault does not take new deposits; its redemptions stay open.
  const isZivoeVaultDeploying = useZivoeVaultStatus() === 'Deploying';

  const assetBalance = useBalance({ chain: selectedChain, tokenAddress: asset.address });
  const shareBalance = useBalance({ chain: selectedChain, tokenAddress: share.shareTokenAddress });
  const allowance = useAllowance({ chain: selectedChain, contract: asset.address, spender: vaultRouterAddress });
  const capacity = useCentrifugeVaultCapacity({ centrifugeVault });
  const access = useInvestorAccess({ centrifugeVault });

  // Only a definitive `false` gates anything. A failed read is a fetch problem
  // and not a verdict about this wallet, so it leaves the flow alone and lets
  // the pre-sign simulation decode the real revert if the Centrifuge vault does refuse.
  const isNotAdmitted = access.isSuccess && !access.data.canReceiveShares;
  // Names the block; never widens it. An unread or unexplained reason simply
  // falls back to the general "not whitelisted" presentation.
  const restriction = access.data?.restriction;

  const balance = assetBalance.data ?? 0n;
  const maxDeposit = capacity.data?.maxDeposit;
  const isCapacityUnavailable = capacity.isSuccess && capacity.data.maxDeposit <= 0n;

  // Approve is the one signature no simulation vets
  // (an ERC-20 approval signs clean against any spender)
  const canOfferApproval = capacity.isSuccess;

  const form = useForm<DepositForm>({
    resolver: zodResolver(
      z.object({
        deposit: createAmountValidator({
          balance,
          decimals: asset.decimals,
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
  const depositRaw = deposit ? parseUnits(deposit, asset.decimals) : undefined;
  const hasDepositRaw = depositRaw !== undefined && depositRaw > 0n;

  // Debounced indicative preview: any raw change immediately drops the previous
  // quote (the query key follows the debounced amount) and only the latest
  // amount's successful response renders.
  const { debouncedValue: debouncedDeposit, isDebouncing } = useDebouncedValue({ value: deposit });
  const debouncedRaw = debouncedDeposit ? parseUnits(debouncedDeposit, asset.decimals) : undefined;
  const preview = useDepositPreview({ centrifugeVault, assets: debouncedRaw ?? 0n });

  const isPreviewCurrent = !isDebouncing && debouncedRaw === depositRaw;
  const previewShares = hasDepositRaw && isPreviewCurrent ? preview.data?.shares : undefined;
  // A retry in flight drops back into the loading presentation (skeleton +
  // pending action) instead of keeping the stale error on screen.
  const isPreviewFailed = hasDepositRaw && isPreviewCurrent && preview.isError && !preview.isFetching;
  const isPreviewLoading = hasDepositRaw && !isPreviewFailed && previewShares === undefined;

  const isPriceUnavailable = isPreviewFailed && isPriceUnavailableError(preview.error);

  const hasEnoughAllowance = checkHasEnoughAllowance({ allowance: allowance.data, amount: depositRaw });
  // Nothing signs against an unknown allowance: Approve would ask for an
  // approval the wallet may not need — and a legacy token's approve would
  // fail at simulation with no readable reason — while Deposit would fail
  // for want of one. The read is retried first.
  const isAllowanceUnavailable = allowance.isError && !allowance.isFetching;

  const approveSpending = useApproveSpending({ zivoeVaultSlug: identity.zivoeVaultSlug });
  const depositMutation = useDeposit({ identity, onSuccessClose: () => setIsEarnDialogOpen(false) });

  // Balances/allowance use isFetching so post-transaction invalidations keep
  // the form locked until fresh data lands.
  const isPrereqsLoading =
    account.isPending ||
    assetBalance.isFetching ||
    shareBalance.isFetching ||
    allowance.isFetching ||
    chainalysis.isFetching ||
    access.isFetching ||
    // isPending on purpose: capacity refetches on a 5-minute interval, and
    // isFetching would flash the whole form to loading on every refresh.
    capacity.isPending;

  // The two blocks differ in what they say about the future. A resolving or
  // failed preview may still clear on its own, so it only gates the action
  // (isSubmitBlocked) and leaves the inputs editable — typing an amount while
  // it clears is reasonable. A deploying Zivoe Vault, a Centrifuge vault with no capacity
  // and a wallet the Centrifuge vault will not admit are settled answers, so they lock
  // the form itself: there is no amount worth entering.
  // Every write shares one wallet and one transaction path — this tab's
  // approve and deposit, the redeem tab's request, the Requests tab's claims
  // and cancels — so the form waits out any of them, wherever it was started;
  // the lifecycle keeps the count across tab switches.
  const isAnyWritePending = useIsAnyTxPending();
  const isOtherWritePending = isAnyWritePending && !approveSpending.isPending && !depositMutation.isPending;
  const isFormLocked =
    isPrereqsLoading || isAnyWritePending || isZivoeVaultDeploying || isCapacityUnavailable || isNotAdmitted;

  // The chain selector must NOT inherit the per-chain verdicts (capacity,
  // access): they are exactly what switching chains escapes, and freezing
  // the selector on them would trap the user on the failing chain. Same
  // gating as the redeem tab's selector.
  const isChainSelectorLocked = isPrereqsLoading || isAnyWritePending;

  // Only the quote and a sibling write gate the action. The settled facts
  // above are enforced one level up, where the ladder swaps this button for a
  // named one — repeating them here would describe states this gate never sees.
  const isSubmitBlocked = isPreviewLoading || isPreviewFailed || isOtherWritePending;

  const maxAmount = maxDeposit !== undefined && maxDeposit < balance ? maxDeposit : balance;

  // The balance and capacity rules are wallet- and vault-scoped, so a verdict
  // about the previous wallet or Centrifuge vault (another chain, or another
  // stablecoin on the same chain) outlives it — 'exceeds balance' would sit on
  // a context that can afford the amount until the next keystroke revalidates.
  useEffect(() => {
    if (account.address) form.clearErrors();
  }, [account.address, selectedChain, centrifugeVault.address, form]);

  const validateForm = () => form.trigger('deposit', { shouldFocus: true });

  const handleApprove = async () => {
    const isValid = await validateForm();
    if (!isValid || isSubmitBlocked) return;

    approveSpending.mutate({
      chain: selectedChain,
      contract: asset.address,
      spender: vaultRouterAddress,
      amount: depositRaw,
      name: asset.symbol,
      decimals: asset.decimals,
      // A legacy token (Ethereum-mainnet USDT) must zero a non-zero allowance
      // before it accepts a new amount; the hook does that from these two.
      approval: asset.approval,
      allowance: allowance.data,
      successMessage: `You can now deposit ${asset.symbol}.`,
      errorMessage: `There was an error approving ${asset.symbol}`
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
  // value equals the entered deposit-asset amount. A failed estimate resolves it here
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
            decimalPlaces={asset.decimals}
            subContent={
              <InputExtraInfo
                dollarValueDecimals={asset.decimals}
                dollarValue={depositRaw ?? 0n}
                balance={{ value: assetBalance.data, isPending: assetBalance.isPending, decimals: asset.decimals }}
              />
            }
            endContent={
              <div className="flex items-center">
                <MaxButton
                  balance={maxAmount}
                  decimals={asset.decimals}
                  onPress={(value) => onChange(value)}
                  isDisabled={isFormLocked}
                />

                <div className="ml-3">
                  {/* Every Centrifuge vault of the page: a chain accepting two
                      stablecoins lists both under the chain. */}
                  <DepositAssetPicker
                    identities={identities}
                    selected={identity}
                    onSelect={setSelectedIdentity}
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
            dollarValueDecimals={asset.decimals}
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
          ) : isNotAdmitted ? (
            <Button fullWidth isDisabled>
              {restriction === 'frozen' ? 'Wallet Frozen' : 'Wallet Not Whitelisted'}
            </Button>
          ) : isAllowanceUnavailable ? (
            <Button fullWidth onPress={() => void allowance.refetch()}>
              Retry
            </Button>
          ) : hasDepositRaw && !hasEnoughAllowance && canOfferApproval ? (
            <Button
              fullWidth
              onPress={() => void handleApprove()}
              isDisabled={isSubmitBlocked}
              isPending={approveSpending.isPending || isPreviewLoading || isOtherWritePending}
              pendingContent={
                isPreviewLoading
                  ? `Estimating ${share.symbol}...`
                  : // A legacy token's allowance reset runs first, under its own
                    // toast; the button says the same until the real approve is
                    // offered to the wallet.
                    approveSpending.isResetPending
                    ? `Resetting ${asset.symbol} approval...`
                    : approveSpending.isTxPending
                      ? `Approving ${asset.symbol}...`
                      : approveSpending.isPending
                        ? 'Signing Transaction...'
                        : isOtherWritePending
                          ? OTHER_WRITE_PENDING_LABEL
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
              isPending={depositMutation.isPending || isPreviewLoading || isOtherWritePending}
              pendingContent={
                isPreviewLoading
                  ? `Estimating ${share.symbol}...`
                  : depositMutation.isTxPending
                    ? `Depositing ${asset.symbol}...`
                    : depositMutation.isPending
                      ? 'Signing Transaction...'
                      : isOtherWritePending
                        ? OTHER_WRITE_PENDING_LABEL
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
          connected; the access verdict only exists once one is. */}
      {isZivoeVaultDeploying ? (
        <Callout variant="warning">Deposits are currently disabled, redemptions are enabled.</Callout>
      ) : isCapacityUnavailable ? (
        <Callout variant="warning">Deposits are currently unavailable, redemptions are enabled.</Callout>
      ) : isNotAdmitted ? (
        <WalletAccessCallout restriction={restriction} />
      ) : isAllowanceUnavailable && !needsChainSwitch && !isPrereqsLoading ? (
        // Only while the Retry above is the action: a wallet on another chain
        // or a read in flight puts a different step there, and "Retry to
        // continue" beside "Switch to Base" would name a control that is not
        // on screen.
        <Callout variant="warning">Could not check your {asset.symbol} approval. Retry to continue.</Callout>
      ) : null}

      {/* TODO: restore the illustrative annualized return once we publish an
          APY to project it from. */}
      {/* {depositRaw ? <EstimatedAnnualizedReturn assets={depositRaw} apy={apy} /> : null} */}
    </>
  );
}
