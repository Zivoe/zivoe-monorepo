import { describe, expect, it, vi } from 'vitest';

import { formatBigIntToReadable, formatBigIntWithCommas, formatNav, formatTokenPrice } from './utils';

// The module's toast import drags in the React runtime; the formatter is pure.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));

const usdc = (value: bigint, displayDecimals = 2) =>
  formatBigIntWithCommas({ value, tokenDecimals: 6, displayDecimals });

describe('formatBigIntWithCommas', () => {
  // Exact amounts whose decimal string is unrepresentable as a float: scaling
  // them by 100 lands just under the integer and floors a whole cent away.
  it('keeps exact amounts that lose a cent through float scaling', () => {
    expect(usdc(570_000n)).toBe('0.57');
    expect(usdc(1_140_000n)).toBe('1.14');
    expect(usdc(1_150_000n)).toBe('1.15');
  });

  it('truncates genuine excess precision instead of rounding up', () => {
    expect(usdc(999_999n)).toBe('0.99');
    expect(usdc(1_234_567_890n)).toBe('1,234.56');
    // A hair under 2, and float scaling used to round it up to a flat 2.00.
    expect(formatBigIntWithCommas({ value: 2n * 10n ** 18n - 1n })).toBe('1.99');
  });

  it('keeps every integer digit of amounts beyond float precision', () => {
    expect(usdc(123_456_789_012_345_678_901_234n)).toBe('123,456,789,012,345,678.90');
  });

  it('marks sub-cent amounts only when showUnderZero is set', () => {
    expect(formatBigIntWithCommas({ value: 9_999n, tokenDecimals: 6, showUnderZero: true })).toBe('<0.01');
    expect(formatBigIntWithCommas({ value: 10_000n, tokenDecimals: 6, showUnderZero: true })).toBe('0.01');
    expect(formatBigIntWithCommas({ value: 0n, tokenDecimals: 6, showUnderZero: true })).toBe('0.00');
    expect(usdc(9_999n)).toBe('0.00');
  });

  it('pads and trims to the requested display precision', () => {
    expect(formatBigIntWithCommas({ value: 1_140_000_000_000_000_000n, displayDecimals: 3 })).toBe('1.140');
    expect(usdc(1_234_567_890n, 0)).toBe('1,234');
    expect(usdc(0n)).toBe('0.00');
  });
});

describe('formatBigIntToReadable', () => {
  // A claim row and the success dialog next to it render the same amount
  // through the two different formatters, so they have to land on the same cent.
  it('agrees with the claim row below the k threshold', () => {
    for (const value of [570_000n, 999_999n, 1_140_000n, 999_999_999n]) {
      expect(formatBigIntToReadable(value, 6)).toBe(formatBigIntWithCommas({ value, tokenDecimals: 6 }));
    }
  });

  it('still summarises larger balances with k and M suffixes', () => {
    expect(formatBigIntToReadable(1_500_000000n, 6)).toBe('1.50k');
    expect(formatBigIntToReadable(2_500_000_000000n, 6)).toBe('2.50M');
  });
});

describe('formatNav', () => {
  it('shows the full dollar amount with separators, truncated to whole dollars', () => {
    expect(formatNav(1_672_345.67)).toBe('1,672,345');
    expect(formatNav(999.99)).toBe('999');
    expect(formatNav(0)).toBe('0');
  });

  it('keeps exact amounts along the navD18 / 1e18 production path', () => {
    expect(formatNav(Number(1_672_345n * 10n ** 18n) / 1e18)).toBe('1,672,345');
  });
});

describe('formatTokenPrice', () => {
  it('truncates at four decimals instead of rounding', () => {
    expect(formatTokenPrice(1.12345)).toBe('1.1234');
    expect(formatTokenPrice(1.99999)).toBe('1.9999');
  });

  it('trims trailing zeros down to a two-decimal minimum', () => {
    expect(formatTokenPrice(1.13)).toBe('1.13');
    expect(formatTokenPrice(1.123)).toBe('1.123');
    expect(formatTokenPrice(1)).toBe('1.00');
  });

  it('keeps exact prices along the sharePriceD18 / 1e18 production path', () => {
    expect(formatTokenPrice(Number(1_130_000_000_000_000_000n) / 1e18)).toBe('1.13');
    expect(formatTokenPrice(Number(1_072_500_000_000_000_000n) / 1e18)).toBe('1.0725');
  });
});
