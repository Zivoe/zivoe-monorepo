import { describe, expect, it, vi } from 'vitest';

import { type ShareStatsPayload } from '@zivoe/centrifuge-indexer';

import { parseChartData } from './deposit-charts-data';

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const DAY_MS = 24 * 60 * 60 * 1000;
// 2026-07-01T00:00:00Z
const day1 = 1782864000000;
const day2 = day1 + DAY_MS;
const today = day1 + 2 * DAY_MS;

const TOKEN_PRICE = 0;
const NAV = 1;

function close(
  timestampMs: number,
  { sharePrice = 1.07, nav = 100, apy = null }: { sharePrice?: number; nav?: number | null; apy?: number | null } = {}
) {
  return { timestampMs, sharePrice, nav, apy };
}

function payload(overrides: Partial<ShareStatsPayload> = {}): ShareStatsPayload {
  return {
    sharePriceD18: '1070000000000000000',
    navD18: '105000000000000000000',
    apy: null,
    priceComputedAtMs: today,
    ...overrides
  };
}

describe('parseChartData', () => {
  it('appends a live today point to the close series and headlines it', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { nav: 100 }), close(day2, { nav: 104 })],
      current: payload(),
      typeIndex: NAV,
      todayStartMs: today
    });

    expect(chart?.data.map((point) => point.data)).toEqual([100, 104, 105]);
    expect(chart?.data[2]?.day).toBe('3 Jul 2026');
    // Literal string so a NAV/Token-Price formatter swap can't pass silently.
    expect(chart?.headline).toBe('$105');
  });

  it('supersedes a same-day price-event bucket with the live overlay', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { nav: 100 }), close(day2, { nav: 104 }), close(today, { nav: 104.5 })],
      current: payload(),
      typeIndex: NAV,
      todayStartMs: today
    });

    expect(chart?.data.map((point) => point.data)).toEqual([100, 104, 105]);
  });

  it('keeps a priced day without issuance in the Token Price series but not in NAV', () => {
    const snapshots = [close(day1, { sharePrice: 1.05, nav: null }), close(day2, { sharePrice: 1.07, nav: 104 })];

    const price = parseChartData({ snapshots, current: null, typeIndex: TOKEN_PRICE, todayStartMs: today });
    expect(price?.data.map((point) => point.data)).toEqual([1.05, 1.07]);

    const nav = parseChartData({ snapshots, current: null, typeIndex: NAV, todayStartMs: today });
    expect(nav?.data.map((point) => point.data)).toEqual([104]);
  });

  it('snaps the price axis to even nice-step gridlines with headroom above the peak', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { sharePrice: 0.01 }), close(day2, { sharePrice: 1.13 })],
      current: null,
      typeIndex: TOKEN_PRICE,
      todayStartMs: today
    });

    expect(chart?.domain).toEqual([0, 1.5]);
    expect(chart?.ticks).toEqual([0, 0.5, 1, 1.5]);
    expect(chart?.tickDecimals).toBe(2);
  });

  it('fits the price axis to a basis-point move so the rise is visible', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { sharePrice: 1.1347863 }), close(day2, { sharePrice: 1.1350468 })],
      current: null,
      typeIndex: TOKEN_PRICE,
      todayStartMs: today
    });

    // The 0.00026 range widens to the 0.0004 min-span guard.
    expect(chart?.domain).toEqual([1.1346, 1.1354]);
    expect(chart?.ticks).toEqual([1.1346, 1.1348, 1.135, 1.1352, 1.1354]);
    expect(chart?.tickDecimals).toBe(4);
  });

  it('widens a perfectly flat price series to the min-span window', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { sharePrice: 1.07 }), close(day2, { sharePrice: 1.07 })],
      current: null,
      typeIndex: TOKEN_PRICE,
      todayStartMs: today
    });

    expect(chart?.domain).toEqual([1.0696, 1.0704]);
    expect(chart?.ticks).toEqual([1.0696, 1.0698, 1.07, 1.0702, 1.0704]);
  });

  it('drops the leading zero closes but keeps zeros once the series is funded', () => {
    const day3 = day1 + 3 * DAY_MS;
    const day4 = day1 + 4 * DAY_MS;

    const chart = parseChartData({
      snapshots: [close(day1, { nav: 0 }), close(day2, { nav: 0 }), close(day3, { nav: 100 }), close(day4, { nav: 0 })],
      current: null,
      typeIndex: NAV,
      todayStartMs: day1 + 5 * DAY_MS
    });

    expect(chart?.data.map((point) => point.data)).toEqual([100, 0]);
    expect(chart?.data[0]?.day).toBe('4 Jul 2026');
  });

  it('drops the leading zero closes from the Token Price series too', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { sharePrice: 0 }), close(day2, { sharePrice: 1.05 })],
      current: null,
      typeIndex: TOKEN_PRICE,
      todayStartMs: today
    });

    expect(chart?.data.map((point) => point.data)).toEqual([1.05]);
  });

  it('plots nothing while every value including the live overlay is still zero', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { nav: 0 }), close(day2, { nav: 0 })],
      current: payload({ navD18: '0' }),
      typeIndex: NAV,
      todayStartMs: today
    });

    expect(chart?.data).toEqual([]);
    expect(chart?.domain).toEqual([0, 1]);
    // The headline still reports the live value with nothing plotted.
    expect(chart?.headline).toBe('$0');
  });

  it('gives the NAV axis snapped ticks that end at the domain edges', () => {
    const chart = parseChartData({
      // Leading zeros are trimmed, so the floor comes from a small funded close.
      snapshots: [close(day1, { nav: 1 }), close(day2, { nav: 1_670_000 })],
      current: null,
      typeIndex: NAV,
      todayStartMs: today
    });

    expect(chart?.domain).toEqual([0, 2_500_000]);
    expect(chart?.ticks).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000]);
  });

  it('zooms the NAV axis to a small accrual on a large base', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { nav: 1_322_884.92 }), close(day2, { nav: 1_674_661.85 })],
      current: null,
      typeIndex: NAV,
      todayStartMs: today
    });

    // The floor tracks the data instead of zero.
    expect(chart?.domain).toEqual([1_200_000, 1_800_000]);
    expect(chart?.ticks).toEqual([1_200_000, 1_400_000, 1_600_000, 1_800_000]);
  });

  it('holds a dust-sized NAV to the absolute min-span floor instead of magnifying it', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { nav: 3.47e-16 })],
      current: null,
      typeIndex: NAV,
      todayStartMs: today
    });

    expect(chart?.domain).toEqual([0, 0.8]);
    expect(chart?.ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
  });

  it('falls back to the newest plotted close when the current payload is unavailable', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { sharePrice: 1.05 }), close(day2, { sharePrice: 1.07 })],
      current: null,
      typeIndex: TOKEN_PRICE,
      todayStartMs: today
    });

    expect(chart?.data).toHaveLength(2);
    expect(chart?.headline).toBe('$1.07');
  });
});
