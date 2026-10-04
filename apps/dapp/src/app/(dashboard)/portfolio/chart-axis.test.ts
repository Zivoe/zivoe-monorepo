import { describe, expect, it } from 'vitest';

import { walletValueAxis } from './chart-axis';

describe('zSMB balance axis', () => {
  it.each([
    { values: [200_000, 200_020], labels: ['$200.000K', '$200.005K', '$200.010K', '$200.015K', '$200.020K'] },
    { values: [1_140_000, 1_140_040], labels: ['$1.14000M', '$1.14001M', '$1.14002M', '$1.14003M', '$1.14004M'] },
    {
      values: [114_000_000, 114_000_040],
      labels: ['$114.00000M', '$114.00001M', '$114.00002M', '$114.00003M', '$114.00004M']
    }
  ])('accurately labels narrow ranges around $values.0', ({ values, labels }) => {
    expect(walletValueAxis(values).labels).toEqual(labels);
  });

  it.each([
    [200_000, 200_020],
    [1_140_000, 1_140_040],
    [114_000_000, 114_000_040],
    [0.001, 0.003],
    [1.2e-18, 2.4e-18],
    [-50, 100],
    [0, 0],
    [42, 42],
    [999, 1001],
    [999_999, 1_000_001],
    [999_999_999, 1_000_000_001],
    [999_999_999_999, 1_000_000_000_001]
  ])('keeps round, evenly spaced, distinct ticks inside the domain for %s–%s', (min, max) => {
    const axis = walletValueAxis([min, max]);
    expect(axis.ticks.length).toBeGreaterThanOrEqual(3);
    expect(new Set(axis.labels).size).toBe(axis.ticks.length);
    for (const [index, tick] of axis.ticks.entries()) {
      expect(tick).toBeGreaterThanOrEqual(axis.domain[0]);
      expect(tick).toBeLessThanOrEqual(axis.domain[1]);
      expect(tick / axis.step).toBeCloseTo(Math.round(tick / axis.step), 5);
      if (index > 0) expect((tick - axis.ticks[index - 1]!) / axis.step).toBeCloseTo(1, 5);
    }
    const span = axis.domain[1] - axis.domain[0];
    if (max > min) {
      const padding = ((max - min) * 0.15) / 0.7;
      expect(axis.domain).toEqual([min - padding, max + padding]);
      // At trillion-dollar magnitudes, double precision limits tiny range ratios.
      const tolerance = Math.max(1e-8, (Math.max(Math.abs(min), Math.abs(max)) * Number.EPSILON) / span);
      expect(Math.abs((min - axis.domain[0]) / span - 0.15)).toBeLessThan(tolerance);
      expect(Math.abs((max - axis.domain[0]) / span - 0.85)).toBeLessThan(tolerance);
    } else {
      expect((min - axis.domain[0]) / span).toBeCloseTo(0.5, 8);
    }
  });

  it('chooses the nearest round step and favors the larger one on ties', () => {
    // Padding makes the domain span 4 × the target step.
    for (const [target, step] of [
      [1, 1],
      [2, 2],
      [2.5, 2.5],
      [5, 5],
      [7.5, 10],
      [1.5, 2],
      [2.25, 2.5],
      [3.75, 5]
    ]) {
      expect(walletValueAxis([0, target! * 4 * 0.7]).step).toBe(step);
    }
  });

  it.each([
    [999, 1001, 'K'],
    [999_999, 1_000_001, 'M'],
    [999_999_999, 1_000_000_001, 'B'],
    [999_999_999_999, 1_000_000_000_001, 'T'],
    [1e15, 1.1e15, 'T']
  ] as const)('uses one unit across the %s–%s boundary', (min, max, suffix) => {
    const { ticks, labels } = walletValueAxis([min, max]);
    const divisor = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[suffix];
    for (const [index, label] of labels.entries()) {
      expect(label.endsWith(suffix)).toBe(true);
      const displayed = Number(label.replace(/[$,KMBT]/g, '')) * divisor;
      expect(displayed / ticks[index]!).toBeCloseTo(1, 12);
    }
  });

  it('selects units from the largest tick magnitude', () => {
    const axis = walletValueAxis([980, 997]);
    expect(axis.domain[1]).toBeGreaterThan(1000);
    expect(axis.labels).toEqual(['$0.980K', '$0.985K', '$0.990K', '$0.995K', '$1.000K']);
    const below = walletValueAxis([990, 997]);
    expect(below.labels.every((label) => !label.endsWith('K'))).toBe(true);
    expect(walletValueAxis([-2_000_000, -1_000_000]).labels.every((label) => label.endsWith('M'))).toBe(true);
  });

  it('normalizes floating-point artifacts and negative zero', () => {
    const axis = walletValueAxis([0.1, 0.3]);
    expect(axis.ticks).toEqual([0.1, 0.15, 0.2, 0.25, 0.3]);
    const zero = walletValueAxis([0, 0]);
    expect(zero.labels).toEqual(['-$0.010', '-$0.005', '$0.000', '$0.005', '$0.010']);
    expect(zero.formatTick(-0)).toBe('$0.000');
    expect(zero.formatTick(-Number.EPSILON)).toBe('$0.000');
  });

  it('ignores missing points without changing the domain and handles empty history', () => {
    const complete = walletValueAxis([200_000, 200_020]);
    const incomplete = walletValueAxis([null, 200_000, null, 200_020, null]);
    expect(incomplete.domain).toEqual(complete.domain);
    expect(incomplete.labels).toEqual(complete.labels);
    expect(walletValueAxis([null, null]).domain).toEqual([-0.01, 0.01]);
    expect(walletValueAxis([]).labels).toEqual(walletValueAxis([0, 0]).labels);
  });
});
