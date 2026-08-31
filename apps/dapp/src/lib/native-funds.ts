import { InsufficientFundsError, formatUnits } from 'viem';

import { AppError } from '@/lib/utils';

/**
 * A wallet short on native tokens fails outside the revert path — the node
 * rejects the call/transaction at the protocol level (no revert data to
 * decode), so these errors are recognized by shape instead: viem's own
 * InsufficientFundsError, geth-style txpool messages ("insufficient funds for
 * gas * price + value"), and reth/Alchemy's eth_call rejection ("EVM error:
 * OutOfFunds").
 */
const INSUFFICIENT_NATIVE_FUNDS_PATTERNS = [
  /insufficient funds/i,
  /out ?of ?funds/i,
  /exceeds the balance of the account/i
];

export function isInsufficientNativeFundsError(err: unknown): boolean {
  for (
    let current = err, depth = 0;
    current instanceof Error && depth < 10;
    current = current.cause as Error, depth++
  ) {
    if (current instanceof InsufficientFundsError) return true;
    if (INSUFFICIENT_NATIVE_FUNDS_PATTERNS.some((pattern) => pattern.test(current.message))) return true;
  }
  return false;
}

export type NativeCurrency = { symbol: string; decimals: number };

/**
 * Product copy for a wallet that cannot cover a transaction's native cost —
 * the attached cross-chain fee (`msg.value`) or plain gas. Always a warning
 * that skips the refetch: the wallet's funding is a user condition, not an app
 * bug, and nothing moved on-chain.
 *
 * `capture` follows how the shortfall was established. A caller that confirmed
 * it against the on-chain balance has nothing to watch and stays silent; a
 * caller that only inferred it from the node's error message opts in, so a
 * misclassification is visible in triage instead of being silently swallowed.
 */
export function insufficientNativeFundsError({
  nativeCurrency,
  requiredValue,
  exception,
  simulation = false,
  capture = false
}: {
  nativeCurrency: NativeCurrency;
  /** The transaction's `msg.value` when known — shown so the user knows how much to add. */
  requiredValue?: bigint;
  exception?: unknown;
  simulation?: boolean;
  capture?: boolean;
}): AppError {
  const { symbol } = nativeCurrency;
  const amount =
    requiredValue !== undefined ? ` (at least ${formatAmountCeil(requiredValue, nativeCurrency.decimals)} ${symbol})` : '';

  return new AppError({
    message: `Not enough ${symbol} in your wallet to cover this transaction's network fee${amount}. Add ${symbol} and try again.`,
    type: 'warning',
    capture,
    refetch: false,
    exception,
    simulation,
    tags: { reason: 'insufficient_native_funds' }
  });
}

/**
 * Rounds up to 5 decimal places so the displayed amount is never below the
 * actual requirement.
 */
function formatAmountCeil(value: bigint, decimals: number): string {
  const precision = 5;
  if (decimals <= precision) return formatUnits(value, decimals);

  const factor = 10n ** BigInt(decimals - precision);
  const roundedUp = (value + factor - 1n) / factor;
  return formatUnits(roundedUp, precision);
}
