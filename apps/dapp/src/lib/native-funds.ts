import { InsufficientFundsError, formatUnits } from 'viem';

import { AppError } from '@/lib/utils';

/**
 * A wallet short on native tokens fails outside the revert path — the node
 * rejects the call/transaction at the protocol level (no revert data to
 * decode), so these errors are recognized by shape instead: viem's own
 * InsufficientFundsError, geth-style txpool messages ("insufficient funds for
 * gas * price + value" — the same string on erigon, op-geth, nitro, coreth,
 * the BSC fork, nethermind and reth), reth/Alchemy's eth_call rejection ("EVM
 * error: OutOfFunds"), Besu's up-front-cost rejections and Monad's eth_call
 * rejection ("insufficient balance", the execution client's own message,
 * observed live on rpc.monad.xyz under JSON-RPC -32603 — a code viem never
 * normalizes into InsufficientFundsError, so this list is the only catch).
 *
 * The Monad pattern is anchored to the start of a line (or viem's "Details:"
 * line) on purpose: token contracts revert with strings like "execution
 * reverted: ERC20: insufficient balance", which must stay a revert, not a
 * funding prompt.
 */
const INSUFFICIENT_NATIVE_FUNDS_PATTERNS = [
  /insufficient funds/i,
  /^(details: )?insufficient balance\b/im,
  /out ?of ?funds/i,
  /exceeds (the balance of the account|(transaction sender )?account balance)/i
];

export function isInsufficientNativeFundsError(err: unknown): boolean {
  for (
    let current = err, depth = 0;
    current instanceof Error && depth < 10;
    current = current.cause as Error, depth++
  ) {
    if (current instanceof InsufficientFundsError) return true;
    // Wallet providers wrap the node's text as `data.message` under a generic
    // "Internal JSON-RPC error." message, which viem's Details line does not
    // carry — so the wrapped text is checked alongside the message itself.
    const wrapped = (current as { data?: { message?: unknown } }).data?.message;
    const texts = [current.message, ...(typeof wrapped === 'string' ? [wrapped] : [])];
    if (INSUFFICIENT_NATIVE_FUNDS_PATTERNS.some((pattern) => texts.some((text) => pattern.test(text)))) return true;
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
