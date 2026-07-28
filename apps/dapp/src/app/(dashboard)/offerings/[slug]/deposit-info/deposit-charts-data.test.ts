import { describe, expect, it, vi } from 'vitest';

import { type ShareStatsPayload } from '@zivoe/centrifuge-indexer';

import { formatChartValue, parseChartData } from './deposit-charts-data';

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const DAY_MS = 24 * 60 * 60 * 1000;
// 2026-07-01T00:00:00Z
const day1 = 1782864000000;
const day2 = day1 + DAY_MS;
const today = day1 + 2 * DAY_MS;

const TOKEN_PRICE = 0;
const AUM = 1;

function close(timestampMs: number, { sharePrice = 1.07, nav = 100, apy = null as number | null } = {}) {
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
      typeIndex: AUM,
      todayStartMs: today
    });

    expect(chart?.data.map((point) => point.data)).toEqual([100, 104, 105]);
    expect(chart?.data[2]?.day).toBe('3 Jul 2026');
    expect(chart?.headline).toBe(formatChartValue('AUM', 105));
  });

  it('supersedes a same-day price-event bucket with the live overlay', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { nav: 100 }), close(day2, { nav: 104 }), close(today, { nav: 104.5 })],
      current: payload(),
      typeIndex: AUM,
      todayStartMs: today
    });

    expect(chart?.data.map((point) => point.data)).toEqual([100, 104, 105]);
  });

  it('falls back to the newest plotted close when the current payload is unavailable', () => {
    const chart = parseChartData({
      snapshots: [close(day1, { sharePrice: 1.05 }), close(day2, { sharePrice: 1.07 })],
      current: null,
      typeIndex: TOKEN_PRICE,
      todayStartMs: today
    });

    expect(chart?.data).toHaveLength(2);
    expect(chart?.headline).toBe(formatChartValue('Token Price', 1.07));
  });
});
