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
import { useBalance } from '@/hooks/useBalance';
import { useChainalysis } from '@/hooks/useChainalysis';
import { useCurrentShareMetrics } from '@/hooks/useCurrentShareMetrics';
import { OTHER_WRITE_PENDING_LABEL, useIsAnyTxPending } from '@/hooks/useIsAnyTxPending';

import ConnectedAccount from '@/components/connected-account';

import {
  sharesToDepositAsset,
  sharesToValueD18,
  useInvestorAccess,
  useRedemptionPosition,
  useRequestRedeem
} from '@/centrifuge';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { SwitchChainButton, useSelectedIdentity } from './_components/chain-switch';
import { InputExtraInfo } from './_components/input-extra-info';
import { MaxButton } from './_components/max-button';
import { PayoutAssetSelector } from './_components/payout-asset-selector';
import { deriveRedeemAccessGates } from './_components/redemption-position-strips';
import { ShareChainSelector } from './_components/share-chain-selector';
import { TokenDisplay } from './_components/token-display';
import { WalletAccessCallout } from './_components/wallet-access-callout';
import { useEarnDialog } from './_hooks/earn-dialog';
import { useTabNavigation } from './_hooks/useTabNavigation';
import { createAmountValidator, parseInput } from './_utils';

type RedeemForm = { redeem: string };

/**
 * The request form alone: the selected chain's share balance redeemed into
 * the selected payout asset. Positions live on the Requests tab; only a
 * Cancellation Processing in the payout vault reaches back here, as a lock
 * with a banner that links there.
 */
export default function RedeemFlow() {
  const {
    chains,
    chainIdentities,
    selectedIdentity: identity,
    selectedChain,
    setSelectedChain,
    setSelectedIdentity,
    needsChainSwitch
  } = useSelectedIdentity({ tab: 'redeem' });

  const { centrifugeVault } = identity;
  const share = centrifugeVault.shareClass;
  const asset = centrifugeVault.asset;

  const account = useAccount();
  const chainalysis = useChainalysis();
  const { setIsOpen: setIsEarnDialogOpen } = useEarnDialog();
  const closeEarnDialog = () => setIsEarnDialogOpen(false);
  const { updateTab } = useTabNavigation();

  const shareBalance = useBalance({ chain: selectedChain, tokenAddress: share.shareTokenAddress });
  const assetBalance = useBalance({ chain: selectedChain, tokenAddress: asset.address });
  // The PAYOUT vault's position: whether a request adds to one, and the cancellation lock.
  const position = useRedemptionPosition({ centrifugeVault });
  const metrics = useCurrentShareMetrics({ shareClassKey: share.key });
  const access = useInvestorAccess({ centrifugeVault });
  const { isNotAdmitted, restriction } = deriveRedeemAccessGates(access);

  const sharePrice = metrics.data ? BigInt(metrics.data.sharePriceD18) : undefined;
  const pendingShares = position.data?.pendingRedeemShares ?? 0n;
  const claimableAssets = position.data?.claimableRedeemAssets ?? 0n;
  const unfundedAssets = position.data?.unfundedClaimableAssets ?? 0n;
  const isCancellationProcessing = position.data?.hasPendingCancelRedeemRequest ?? false;
  const hasPosition = pendingShares > 0n || claimableAssets > 0n || unfundedAssets > 0n;

  const form = useForm<RedeemForm>({
    resolver: zodResolver(
      z.object({
        redeem: createAmountValidator({
          balance: shareBalance.data ?? 0n,
          decimals: share.decimals,
          requiredMessage: 'Redeem amount is required',
          exceedsMessage: 'Redeem amount exceeds balance'
        })
      })
    ),
    defaultValues: { redeem: undefined },
    mode: 'onChange'
  });

  const redeem = form.watch('redeem');
  const redeemRaw = redeem ? parseUnits(redeem, share.decimals) : undefined;
  const hasRedeemRaw = redeemRaw !== undefined && redeemRaw > 0n;

  const estimatedAssets =
    hasRedeemRaw && sharePrice
      ? sharesToDepositAsset({ shares: redeemRaw, sharePrice, shareClass: share, asset })
      : undefined;
  const redeemDollarValue =
    redeemRaw !== undefined && sharePrice
      ? sharesToValueD18({ shares: redeemRaw, sharePrice, shareClass: share })
      : redeem
        ? null
        : 0n;

  const requestRedeem = useRequestRedeem({ identity, onSuccessClose: closeEarnDialog });

  // Balances/position use isFetching so post-transaction invalidations keep
  // the form locked until fresh data lands; the position never polls, so
  // only the initial load and those refetches ever set it.
  const isPrereqsLoading =
    account.isPending ||
    shareBalance.isFetching ||
    assetBalance.isFetching ||
    chainalysis.isFetching ||
    access.isFetching ||
    position.isFetching ||
    // isPending on purpose: metrics refetch on a 5-minute interval, and
    // isFetching would flash the whole form to loading on every refresh.
    metrics.isPending;

  // Any write, on any tab, locks the form (see useIsAnyTxPending).
  const isAnyWritePending = useIsAnyTxPending();
  // A Cancellation Processing in the PAYOUT vault locks the form: a new request
  // into it would revert until the hub finishes the unwind, while another
  // payout asset on the chain stays open. A wallet the Centrifuge vault will
  // not admit locks it too. Only the request gate applies here: a wallet that
  // may still send shares to escrow can use this form even when its share
  // moves back are blocked.
  const isFormLocked = isPrereqsLoading || isAnyWritePending || isCancellationProcessing || isNotAdmitted;

  // Chain-agnostic locks only — the rule lives on useSelectedChain's doc.
  // Named like the deposit tab's carrier so the two selectors cannot drift.
  const isChainSelectorLocked = isPrereqsLoading || isAnyWritePending;

  // Named once, like the deposit tab's, so the button and its handler cannot
  // drift apart. Only a sibling write gates the action; the settled facts above
  // are enforced one level up, where the ladder swaps this button for a named
  // one — repeating them here would describe states this gate never sees.
  const isSubmitBlocked = isAnyWritePending && !requestRedeem.isPending;

  // Balance reads do not toast (see useBalance), so the form names a failed
  // read of the shares it spends: an unknown balance would validate every
  // amount as too large behind a live button.
  const isBalanceUnavailable = shareBalance.isError && !shareBalance.isFetching;

  // Both states are presentation only, and both are scoped to an entered amount
  // to match the deposit tab. The estimate quotes a price that will not be the
  // settlement price anyway — the callout below the row says as much — so it
  // never gates the request; it only decides what the Estimated receive row
  // shows. A retry in flight shows loading rather than the stale error, and a
  // fetched Share Price of 0 (pre-first-price row or upstream glitch) counts as
  // failed, so the row resolves instead of skeletoning forever.
  const isEstimateFailed =
    hasRedeemRaw && (metrics.isError || (!metrics.isPending && !sharePrice)) && !metrics.isFetching;
  const isEstimateLoading = hasRedeemRaw && !isEstimateFailed && estimatedAssets === undefined;

  const validateForm = () => form.trigger('redeem', { shouldFocus: true });

  const handleRequestRedeem = async () => {
    const isValid = await validateForm();
    if (!isValid || isSubmitBlocked) return;
    // Narrowing only — validation guarantees redeemRaw. estimatedAssets is
    // deliberately not required: it rides along for the receipt.
    if (!redeemRaw) return;

    requestRedeem.mutate(
      { shares: redeemRaw, estimatedAssets },
      // A reverted receipt also resolves as mutation success (it routes to the
      // failure dialog) — keep the entered amount so the user can retry as-is.
      { onSuccess: ({ receipt }) => receipt.status === 'success' && form.reset({ redeem: undefined }) }
    );
  };

  // Balance verdicts are wallet- and chain-scoped — see the deposit tab.
  useEffect(() => {
    if (account.address) form.clearErrors();
  }, [account.address, selectedChain, form]);

  const receiveValue = estimatedAssets !== undefined ? formatUnits(estimatedAssets, asset.decimals) : '';
  // Suppress the amount input's `0.0` ghost while the estimate is loading —
  // it would otherwise read as "you receive 0.0" next to the skeleton.
  const receivePlaceholder = isEstimateLoading ? '' : undefined;
  const receiveDollarValue = isEstimateFailed ? 0n : (estimatedAssets ?? (redeem ? null : 0n));

  return (
    <>
      {/* A failed position read renders like "no position" and does not
          toast, so the form names it. */}
      {position.isError && (
        <Callout variant="warning">
          Could not load your redemption position on {CHAIN_DISPLAY[selectedChain].label}.{' '}
          <Button variant="link-primary" size="s" onPress={() => void position.refetch()}>
            Retry
          </Button>
        </Callout>
      )}

      {isCancellationProcessing && (
        <Callout variant="warning">
          New redemption requests into {asset.symbol} on {CHAIN_DISPLAY[selectedChain].label} are paused while a
          cancellation is processed.{' '}
          <Button variant="link-primary" size="s" onPress={() => updateTab('requests')}>
            View requests
          </Button>
        </Callout>
      )}

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
            isDisabled={isFormLocked}
            decimalPlaces={share.decimals}
            subContent={
              <InputExtraInfo
                // sharesToValueD18 is 18-decimal whatever the share token's own
                // decimals are; the balance carries the token's scale itself.
                dollarValueDecimals={18}
                dollarValue={redeemDollarValue}
                balance={{ value: shareBalance.data, isPending: shareBalance.isPending, decimals: share.decimals }}
              />
            }
            endContent={
              <div className="flex items-center">
                <MaxButton
                  balance={shareBalance.data ?? 0n}
                  decimals={share.decimals}
                  onPress={(value) => onChange(value)}
                  isDisabled={isFormLocked}
                />

                <div className="ml-3">
                  <ShareChainSelector
                    chains={chains}
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
          isEstimateFailed ? (
            <>
              Unable to estimate {asset.symbol}.{' '}
              <Button variant="link-alert" size="s" onPress={() => void metrics.refetch()}>
                Retry
              </Button>
            </>
          ) : undefined
        }
        isInvalid={isEstimateFailed}
        startContent={isEstimateLoading ? <Skeleton className="h-6 w-24" /> : undefined}
        subContent={
          <InputExtraInfo
            dollarValueDecimals={asset.decimals}
            dollarValue={receiveDollarValue}
            isLoading={isEstimateLoading}
            balance={{ value: assetBalance.data, isPending: assetBalance.isPending, decimals: asset.decimals }}
          />
        }
        endContent={
          chainIdentities.length > 1 ? (
            <PayoutAssetSelector
              identities={chainIdentities}
              selected={identity}
              onSelect={setSelectedIdentity}
              isDisabled={isChainSelectorLocked}
            />
          ) : (
            <TokenDisplay symbol={asset.symbol} />
          )
        }
      />

      <ConnectedAccount>
        {needsChainSwitch ? (
          <SwitchChainButton />
        ) : isPrereqsLoading ? (
          <Button fullWidth isPending={true} pendingContent="Loading..." />
        ) : isCancellationProcessing ? (
          <Button fullWidth isDisabled>
            Cancellation in progress
          </Button>
        ) : isNotAdmitted ? (
          <Button fullWidth isDisabled>
            {restriction === 'frozen' ? 'Wallet Frozen' : 'Wallet Not Whitelisted'}
          </Button>
        ) : isBalanceUnavailable ? (
          <Button fullWidth onPress={() => void shareBalance.refetch()}>
            Retry
          </Button>
        ) : (
          <Button
            fullWidth
            onPress={() => void handleRequestRedeem()}
            isDisabled={isSubmitBlocked}
            isPending={requestRedeem.isPending || isSubmitBlocked}
            pendingContent={
              requestRedeem.isTxPending
                ? 'Requesting redemption...'
                : requestRedeem.isPending
                  ? 'Signing Transaction...'
                  : isSubmitBlocked
                    ? OTHER_WRITE_PENDING_LABEL
                    : undefined
            }
          >
            {hasPosition ? 'Add to redemption' : 'Request redemption'}
          </Button>
        )}
      </ConnectedAccount>

      <div className="flex flex-col gap-1.5">
        <Callout variant="warning">
          Redemptions are processed periodically. Your final {asset.symbol} amount is determined using the Token Price
          when your request is processed.
        </Callout>

        {/* Why the action above is disabled — the verdict only exists once a
            wallet is connected. */}
        {isNotAdmitted ? (
          <WalletAccessCallout restriction={restriction} />
        ) : isBalanceUnavailable && !needsChainSwitch && !isPrereqsLoading && !isCancellationProcessing ? (
          // Only while the Retry above is the action.
          <Callout variant="warning">Could not load your {share.symbol} balance. Retry to continue.</Callout>
        ) : null}
      </div>
    </>
  );
}
