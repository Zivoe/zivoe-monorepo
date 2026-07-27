import * as Sentry from '@sentry/nextjs';
import { type TransactionReceipt } from 'viem';

import { readVaultReceiptEvents } from './vault-receipt';

type VaultReceiptAmounts = { assets: bigint; shares: bigint } | undefined;

/**
 * Builds a decoder that reads the configured vault's event from a confirmed
 * receipt into exact plain amounts. Returns undefined on failure
 * (Sentry-captured) — a confirmed on-chain transaction must never be displayed
 * as failed. Decodes are memoized per receipt (a decoder runs for both the
 * transaction dialog and receipt analytics), keeping a failure to one capture.
 */
function createVaultReceiptDecoder({
  eventName,
  flow,
  errorMessage
}: {
  eventName: 'Deposit' | 'Withdraw';
  flow: string;
  errorMessage: string;
}) {
  const decodedReceipts = new WeakMap<TransactionReceipt, VaultReceiptAmounts>();

  return function decode(receipt: TransactionReceipt): VaultReceiptAmounts {
    if (decodedReceipts.has(receipt)) return decodedReceipts.get(receipt);

    let amounts: VaultReceiptAmounts;

    try {
      // One transaction can carry several vault events (a batched router
      // call); the displayed amounts are their sum — the same aggregation the
      // rest of the app applies to receipts.
      const events = readVaultReceiptEvents({ receipt, eventName });
      if (events.length > 0)
        amounts = {
          // The 'in' narrowing is for the ABI union only: both Deposit and
          // Withdraw always carry assets.
          assets: events.reduce((sum, args) => sum + ('assets' in args ? args.assets : 0n), 0n),
          shares: events.reduce((sum, args) => sum + args.shares, 0n)
        };
    } catch {
      // Fall through to the capture below.
    }

    if (!amounts)
      Sentry.captureException(new Error(errorMessage), {
        tags: { source: 'MUTATION', flow },
        extra: { txHash: receipt.transactionHash }
      });

    decodedReceipts.set(receipt, amounts);
    return amounts;
  };
}

export const decodeSyncDepositReceipt = createVaultReceiptDecoder({
  eventName: 'Deposit',
  flow: 'deposit',
  errorMessage: 'Failed to decode sync deposit receipt'
});

export const decodeClaimRedeemReceipt = createVaultReceiptDecoder({
  eventName: 'Withdraw',
  flow: 'redeem-claim',
  errorMessage: 'Failed to decode redeem claim receipt'
});

const decodedReturnedSharesReceipts = new WeakMap<TransactionReceipt, { shares: bigint } | undefined>();

/**
 * Same contract as createVaultReceiptDecoder, but for CancelRedeemClaim —
 * the one lifecycle event carrying only shares, no assets.
 */
export function decodeClaimReturnedSharesReceipt(receipt: TransactionReceipt): { shares: bigint } | undefined {
  if (decodedReturnedSharesReceipts.has(receipt)) return decodedReturnedSharesReceipts.get(receipt);

  let amounts: { shares: bigint } | undefined;

  try {
    const events = readVaultReceiptEvents({ receipt, eventName: 'CancelRedeemClaim' });
    if (events.length > 0) amounts = { shares: events.reduce((sum, args) => sum + args.shares, 0n) };
  } catch {
    // Fall through to the capture below.
  }

  if (!amounts)
    Sentry.captureException(new Error('Failed to decode returned shares claim receipt'), {
      tags: { source: 'MUTATION', flow: 'redeem-claim-returned' },
      extra: { txHash: receipt.transactionHash }
    });

  decodedReturnedSharesReceipts.set(receipt, amounts);
  return amounts;
}
