import * as Sentry from '@sentry/nextjs';
import { type ParseEventLogsReturnType, type TransactionReceipt } from 'viem';

import {
  type CENTRIFUGE_VAULT_LIFECYCLE_EVENTS_ABI,
  type CentrifugeVaultLifecycleEventName,
  readCentrifugeVaultReceiptEvents
} from './centrifuge-vault-receipt';
import { type TransactionIdentity } from './types';

/** The exact args shape of one Centrifuge-vault lifecycle event, as viem strictly decodes it. */
type CentrifugeVaultEventArgs<TEventName extends CentrifugeVaultLifecycleEventName> = ParseEventLogsReturnType<
  typeof CENTRIFUGE_VAULT_LIFECYCLE_EVENTS_ABI,
  TEventName,
  true
>[number]['args'];

/**
 * Builds a decoder that reads the transacted Centrifuge vault's event from a confirmed
 * receipt into exact plain amounts via `aggregate` — one transaction can carry
 * several Centrifuge-vault events (a batched router call), so amounts are summed.
 * Returns undefined on failure (Sentry-captured) — a confirmed on-chain
 * transaction must never be displayed as failed. Decodes are memoized per
 * receipt and Centrifuge vault (a decoder runs for both the transaction dialog and
 * receipt analytics), keeping a failure to one capture without letting one
 * Centrifuge vault's amounts answer for another's.
 */
function createCentrifugeVaultReceiptDecoder<
  TEventName extends CentrifugeVaultLifecycleEventName,
  TAmounts extends object
>({
  eventName,
  aggregate,
  flow,
  errorMessage
}: {
  eventName: TEventName;
  aggregate: (events: Array<CentrifugeVaultEventArgs<TEventName>>) => TAmounts;
  flow: string;
  errorMessage: string;
}) {
  const decodedReceipts = new WeakMap<TransactionReceipt, Map<string, TAmounts | undefined>>();

  // The whole identity, not loose Centrifuge-vault/slug halves: the pair must always
  // come from one Offering, and separate parameters would let a call site
  // tag a capture with one Offering while decoding another's Centrifuge vault.
  return function decode({
    receipt,
    identity
  }: {
    receipt: TransactionReceipt;
    identity: TransactionIdentity;
  }): TAmounts | undefined {
    const { centrifugeVaultAddress } = identity.shareClass;
    const byCentrifugeVault = decodedReceipts.get(receipt) ?? new Map<string, TAmounts | undefined>();
    const centrifugeVaultKey = centrifugeVaultAddress.toLowerCase();
    if (byCentrifugeVault.has(centrifugeVaultKey)) return byCentrifugeVault.get(centrifugeVaultKey);

    let amounts: TAmounts | undefined;

    try {
      // Inside this generic body the reader types args as the ABI union; the
      // call sites instantiate TEventName with a literal, so the cast only
      // restores the precision the generic boundary erased.
      const events = readCentrifugeVaultReceiptEvents({ receipt, eventName, centrifugeVaultAddress }) as Array<
        CentrifugeVaultEventArgs<TEventName>
      >;
      if (events.length > 0) amounts = aggregate(events);
    } catch {
      // Fall through to the capture below.
    }

    if (!amounts)
      Sentry.captureException(new Error(errorMessage), {
        tags: { source: 'MUTATION', flow, offering: identity.offeringSlug },
        extra: { txHash: receipt.transactionHash, centrifugeVaultAddress }
      });

    byCentrifugeVault.set(centrifugeVaultKey, amounts);
    decodedReceipts.set(receipt, byCentrifugeVault);
    return amounts;
  };
}

export const decodeSyncDepositReceipt = createCentrifugeVaultReceiptDecoder({
  eventName: 'Deposit',
  aggregate: (events) => ({
    assets: events.reduce((sum, args) => sum + args.assets, 0n),
    shares: events.reduce((sum, args) => sum + args.shares, 0n)
  }),
  flow: 'deposit',
  errorMessage: 'Failed to decode sync deposit receipt'
});

export const decodeClaimRedeemReceipt = createCentrifugeVaultReceiptDecoder({
  eventName: 'Withdraw',
  aggregate: (events) => ({
    assets: events.reduce((sum, args) => sum + args.assets, 0n),
    shares: events.reduce((sum, args) => sum + args.shares, 0n)
  }),
  flow: 'redeem-claim',
  errorMessage: 'Failed to decode redeem claim receipt'
});

// CancelRedeemClaim is the one lifecycle event carrying only shares, no assets.
export const decodeClaimReturnedSharesReceipt = createCentrifugeVaultReceiptDecoder({
  eventName: 'CancelRedeemClaim',
  aggregate: (events) => ({ shares: events.reduce((sum, args) => sum + args.shares, 0n) }),
  flow: 'redeem-claim-returned',
  errorMessage: 'Failed to decode returned shares claim receipt'
});
