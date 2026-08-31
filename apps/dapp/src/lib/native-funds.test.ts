import { InsufficientFundsError } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/utils';

import { insufficientNativeFundsError, isInsufficientNativeFundsError } from './native-funds';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const ETH = { symbol: 'ETH', decimals: 18 };

describe('isInsufficientNativeFundsError', () => {
  it.each([
    ['viem InsufficientFundsError', new InsufficientFundsError({})],
    ['geth txpool message', new Error('insufficient funds for gas * price + value: balance 0, tx cost 100')],
    ['reth eth_call rejection', new Error('EVM error: OutOfFunds')],
    ['viem total-cost message', new Error('The total cost of executing this transaction exceeds the balance of the account.')]
  ])('recognizes %s', (_label, err) => {
    expect(isInsufficientNativeFundsError(err)).toBe(true);
  });

  it('walks the cause chain', () => {
    const err = new Error('request failed', { cause: new Error('wrapped', { cause: new Error('out of funds') }) });
    expect(isInsufficientNativeFundsError(err)).toBe(true);
  });

  it('rejects unrelated errors and non-errors', () => {
    expect(isInsufficientNativeFundsError(new Error('execution reverted'))).toBe(false);
    expect(isInsufficientNativeFundsError('insufficient funds')).toBe(false);
    expect(isInsufficientNativeFundsError(undefined)).toBe(false);
  });
});

describe('insufficientNativeFundsError', () => {
  it('builds a non-captured warning with the required amount rounded up', () => {
    // 0.000473469950961388 ETH — rounds up to 0.00048, never down.
    const err = insufficientNativeFundsError({ nativeCurrency: ETH, requiredValue: 473469950961388n });

    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toBe(
      "Not enough ETH in your wallet to cover this transaction's network fee (at least 0.00048 ETH). Add ETH and try again."
    );
    expect(err).toMatchObject({ type: 'warning', capture: false, refetch: false, simulation: false });
  });

  it('omits the amount when the required value is unknown', () => {
    const err = insufficientNativeFundsError({ nativeCurrency: ETH });
    expect(err.message).toBe(
      "Not enough ETH in your wallet to cover this transaction's network fee. Add ETH and try again."
    );
  });

  it('captures only when the caller opts in, and always tags the reason', () => {
    expect(insufficientNativeFundsError({ nativeCurrency: ETH })).toMatchObject({ capture: false });
    expect(insufficientNativeFundsError({ nativeCurrency: ETH, capture: true })).toMatchObject({
      capture: true,
      tags: { reason: 'insufficient_native_funds' }
    });
  });
});
