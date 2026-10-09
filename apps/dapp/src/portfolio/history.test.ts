import { describe, expect, it } from 'vitest';

import { type DailyTokenSnapshot, type InvestorPositionCheckpoint } from '@zivoe/centrifuge-indexer';

import { DAY_MS } from '@/components/chart/axis';

import { availableRanges, buildBalanceHistory, rangeChange, selectRange } from './history';

const D18 = 10n ** 18n;
// 2026-07-01T00:00:00Z
const DAY1 = 1782864000000;
const day = (index: number) => DAY1 + index * DAY_MS;
const CHAINS = [
  { chainId: 1, decimals: 8 },
  { chainId: 8453, decimals: 8 }
];

function checkpoint(chainId: number, timestampMs: number, balanceAfter: bigint): InvestorPositionCheckpoint {
  return { chainId, balanceAfter, timestampMs, block: 1, logIndex: 0, txHash: '0x1' };
}

function price(dayStartMs: number, tokenPrice: bigint): DailyTokenSnapshot {
  return { dayStartSeconds: dayStartMs / 1000, tokenPrice, totalIssuance: null, yield30dComp365: null };
}

describe('buildBalanceHistory', () => {
  it("values the end-of-day balance on every chain at that day's close, carrying a missing close forward", () => {
    const history = buildBalanceHistory({
      checkpoints: [
        checkpoint(1, day(0) + 1000, 100_000_000n), // 1 share on chain 1 during day 0
        checkpoint(8453, day(1) + 5000, 50_000_000n), // +0.5 on Base during day 1
        checkpoint(1, day(2) + 5000, 0n) // chain 1 emptied during day 2
      ],
      chains: CHAINS,
      prices: [price(day(0), D18), price(day(2), 2n * D18)], // day 1 has no close row
      liveBalances: new Map([
        [1, 0n],
        [8453, 50_000_000n]
      ]),
      livePrice: 3n * D18,
      nowMs: day(3) + 12 * 60 * 60 * 1000
    });

    expect(history.points.map((point) => [point.timestampMs, point.valueD18])).toEqual([
      [day(1) - 1, 1n * D18], // 1 × 1.00
      [day(2) - 1, (15n * D18) / 10n], // 1.5 × 1.00 (carried)
      [day(3) - 1, 1n * D18] // 0.5 × 2.00
    ]);
    expect(history.livePoint).toEqual({ timestampMs: day(3) + 12 * 60 * 60 * 1000, valueD18: (15n * D18) / 10n });
  });

  it('skips the days before the first known close and omits the live point while a balance is unknown', () => {
    const history = buildBalanceHistory({
      checkpoints: [checkpoint(1, day(0), 100_000_000n)],
      chains: CHAINS,
      prices: [price(day(1), D18)],
      liveBalances: new Map([[1, 100_000_000n]]),
      livePrice: D18,
      nowMs: day(2)
    });

    expect(history.points.map((point) => point.timestampMs)).toEqual([day(2) - 1]);
    expect(history.livePoint).toBeUndefined();
  });

  it('files a checkpoint stamped exactly at midnight on the day that starts, and ignores one after now', () => {
    const history = buildBalanceHistory({
      checkpoints: [checkpoint(1, day(1), 100_000_000n), checkpoint(1, day(3) + 1, 0n)],
      chains: [CHAINS[0]!],
      prices: [price(day(1), D18)],
      liveBalances: new Map([[1, 100_000_000n]]),
      livePrice: D18,
      nowMs: day(3)
    });

    // Day 1 (the day the midnight checkpoint starts) closes with the balance; the later checkpoint is in the future.
    expect(history.points.map((point) => [point.timestampMs, point.valueD18])).toEqual([
      [day(2) - 1, D18],
      [day(3) - 1, D18]
    ]);
  });

  it('has no past but still a live point for a wallet the indexer has not seen', () => {
    const history = buildBalanceHistory({
      checkpoints: [],
      chains: CHAINS,
      prices: [],
      liveBalances: new Map([
        [1, 100_000_000n],
        [8453, 0n]
      ]),
      livePrice: D18,
      nowMs: day(2)
    });

    expect(history.points).toEqual([]);
    expect(history.livePoint?.valueD18).toBe(D18);
  });
});

describe('ranges', () => {
  const nowMs = day(40) + 1000;
  const history = {
    points: Array.from({ length: 35 }, (_, index) => ({ timestampMs: day(6 + index) - 1, valueD18: D18 })),
    livePoint: { timestampMs: nowMs, valueD18: D18 }
  };

  it('offers only the ranges the history reaches back to', () => {
    expect(availableRanges({ history, nowMs })).toEqual(['7D', '30D', 'All']);
    // Exactly 30 day closes back: the 30D window's first day is covered, 90D is not.
    const exact = { ...history, points: history.points.slice(-29) };
    expect(availableRanges({ history: exact, nowMs })).toEqual(['7D', '30D', 'All']);
    const short = { ...history, points: history.points.slice(-28) };
    expect(availableRanges({ history: short, nowMs })).toEqual(['7D', 'All']);
    expect(availableRanges({ history: { points: [], livePoint: history.livePoint }, nowMs })).toEqual(['All']);
  });

  it("selects the window's day closes and ends on the live point", () => {
    const points = selectRange({ history, range: '7D', nowMs });

    expect(points).toHaveLength(7); // 6 closes + today
    expect(points[0]?.timestampMs).toBe(day(35) - 1);
    expect(points.at(-1)).toBe(history.livePoint);
  });
});

describe('rangeChange', () => {
  it('reads the last drawn point against the first, with a percent only off a non-zero base', () => {
    const point = (index: number, valueD18: bigint) => ({ timestampMs: day(index), valueD18 });
    expect(rangeChange([point(0, 100n * D18), point(1, 90n * D18), point(2, (10125n * D18) / 100n)])).toEqual({
      deltaD18: (125n * D18) / 100n,
      percent: 1.25
    });
    expect(rangeChange([point(0, 100n * D18), point(1, 95n * D18)])).toEqual({ deltaD18: -5n * D18, percent: -5 });
    // Two decimals of percent, truncated like every other figure: 1/3 is 0.33.
    expect(rangeChange([point(0, 3n * D18), point(1, 4n * D18)])).toEqual({ deltaD18: D18, percent: 33.33 });
    expect(rangeChange([point(0, 0n), point(1, 4n * D18)])).toEqual({ deltaD18: 4n * D18 });
  });

  it('needs two points', () => {
    expect(rangeChange([])).toBeUndefined();
    expect(rangeChange([{ timestampMs: day(0), valueD18: D18 }])).toBeUndefined();
  });
});
