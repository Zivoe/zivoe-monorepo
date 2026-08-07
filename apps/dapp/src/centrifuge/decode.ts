import * as Sentry from '@sentry/nextjs';
import { type ParseEventLogsReturnType, type TransactionReceipt } from 'viem';

import { type TransactionIdentity } from './types';
import { type VAULT_LIFECYCLE_EVENTS_ABI, type VaultLifecycleEventName, readVaultReceiptEvents } from './vault-receipt';

/** The exact args shape of one vault lifecycle event, as viem strictly decodes it. */
type VaultEventArgs<TEventName extends VaultLifecycleEventName> = ParseEventLogsReturnType<
  typeof VAULT_LIFECYCLE_EVENTS_ABI,
  TEventName,
  true
>[number]['args'];

/**
 * Builds a decoder that reads the transacted vault's event from a confirmed
 * receipt into exact plain amounts via `aggregate` — one transaction can carry
 * several vault events (a batched router call), so amounts are summed.
 * Returns undefined on failure (Sentry-captured) — a confirmed on-chain
 * transaction must never be displayed as failed. Decodes are memoized per
 * receipt and vault (a decoder runs for both the transaction dialog and
 * receipt analytics), keeping a failure to one capture without letting one
 * vault's amounts answer for another's.
 */
function createVaultReceiptDecoder<TEventName extends VaultLifecycleEventName, TAmounts extends object>({
  eventName,
  aggregate,
  flow,
  errorMessage
}: {
  eventName: TEventName;
  aggregate: (events: Array<VaultEventArgs<TEventName>>) => TAmounts;
  flow: string;
  errorMessage: string;
}) {
  const decodedReceipts = new WeakMap<TransactionReceipt, Map<string, TAmounts | undefined>>();

  // The whole identity, not loose vault/slug halves: the pair must always
  // come from one Offering, and separate parameters would let a call site
  // tag a capture with one Offering while decoding another's vault.
  return function decode({
    receipt,
    identity
  }: {
    receipt: TransactionReceipt;
    identity: TransactionIdentity;
  }): TAmounts | undefined {
    const { vaultAddress } = identity.shareClass;
    const byVault = decodedReceipts.get(receipt) ?? new Map<string, TAmounts | undefined>();
    const vaultKey = vaultAddress.toLowerCase();
    if (byVault.has(vaultKey)) return byVault.get(vaultKey);

    let amounts: TAmounts | undefined;

    try {
      // Inside this generic body the reader types args as the ABI union; the
      // call sites instantiate TEventName with a literal, so the cast only
      // restores the precision the generic boundary erased.
      const events = readVaultReceiptEvents({ receipt, eventName, vaultAddress }) as Array<VaultEventArgs<TEventName>>;
      if (events.length > 0) amounts = aggregate(events);
    } catch {
      // Fall through to the capture below.
    }

    if (!amounts)
      Sentry.captureException(new Error(errorMessage), {
        tags: { source: 'MUTATION', flow, offering: identity.offeringSlug },
        extra: { txHash: receipt.transactionHash, vaultAddress }
      });

    byVault.set(vaultKey, amounts);
    decodedReceipts.set(receipt, byVault);
    return amounts;
  };
}

export const decodeSyncDepositReceipt = createVaultReceiptDecoder({
  eventName: 'Deposit',
  aggregate: (events) => ({
    assets: events.reduce((sum, args) => sum + args.assets, 0n),
    shares: events.reduce((sum, args) => sum + args.shares, 0n)
  }),
  flow: 'deposit',
  errorMessage: 'Failed to decode sync deposit receipt'
});

export const decodeClaimRedeemReceipt = createVaultReceiptDecoder({
  eventName: 'Withdraw',
  aggregate: (events) => ({
    assets: events.reduce((sum, args) => sum + args.assets, 0n),
    shares: events.reduce((sum, args) => sum + args.shares, 0n)
  }),
  flow: 'redeem-claim',
  errorMessage: 'Failed to decode redeem claim receipt'
});

// CancelRedeemClaim is the one lifecycle event carrying only shares, no assets.
export const decodeClaimReturnedSharesReceipt = createVaultReceiptDecoder({
  eventName: 'CancelRedeemClaim',
  aggregate: (events) => ({ shares: events.reduce((sum, args) => sum + args.shares, 0n) }),
  flow: 'redeem-claim-returned',
  errorMessage: 'Failed to decode returned shares claim receipt'
});
