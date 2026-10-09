import { describe, expect, it } from 'vitest';

import { DAY_MS, dayTicks, formatDayTick, niceAxis, stepDecimals, valueAxis } from './axis';

// 2026-07-01T00:00:00Z
const day1 = 1782864000000;

describe('valueAxis', () => {
  it('floors a padded domain at zero and brackets the data with ticks', () => {
    const axis = valueAxis({ values: [99_998, 801_453], minSpan: 1 });

    expect(axis.domain[0]).toBe(0);
    expect(axis.ticks[0]).toBe(0);
    expect(axis.ticks.at(-1)).toBeGreaterThanOrEqual(801_453);
    expect(axis.ticks.every((tick, index) => index === 0 || tick > axis.ticks[index - 1]!)).toBe(true);
  });

  it('holds a sub-cent move to the min-span window instead of stretching it', () => {
    const axis = valueAxis({ values: [3.3563, 3.3609], minSpan: 0.05 });

    expect(axis.domain[1] - axis.domain[0]).toBeGreaterThanOrEqual(0.05);
    expect(stepDecimals(axis.step)).toBe(2);
  });

  it('gives an empty series a unit domain', () => {
    expect(valueAxis({ values: [], minSpan: 1 }).domain).toEqual([0, 1]);
  });
});

describe('niceAxis', () => {
  it('never puts a gridline below zero for a non-negative window', () => {
    expect(niceAxis({ min: 0.2, max: 1.8 }).domain[0]).toBe(0);
  });
});

describe('dayTicks', () => {
  it('labels at most seven days, the newest always included', () => {
    const ticks = dayTicks({ firstTs: day1, lastTs: day1 + 29 * DAY_MS });

    expect(ticks.length).toBeLessThanOrEqual(7);
    expect(ticks.at(-1)).toBe(day1 + 29 * DAY_MS);
    expect(formatDayTick(ticks.at(-1)!)).toBe('30 Jul');
  });

  it('is empty without a series', () => {
    expect(dayTicks({ firstTs: undefined, lastTs: undefined })).toEqual([]);
  });
});
