import { describe, expect, it } from 'vitest';

import { formatNav, formatTokenPrice, mergeMetric, unavailableMetric } from './home-metrics';

describe('exact metric formatting', () => {
  it('rounds token price at four places without floating point conversion', () => {
    expect(formatTokenPrice('1137949999999999999')).toBe('$1.1379');
    expect(formatTokenPrice('1137950000000000000')).toBe('$1.1380');
    expect(formatTokenPrice('9999950000000000000')).toBe('$10.0000');
  });
  it('formats compact NAV and promotes rounded unit boundaries', () => {
    expect(formatNav((2070000n * 10n ** 36n).toString())).toBe('$2.07M');
    expect(formatNav((999995n * 10n ** 36n - 1n).toString())).toBe('$999.99K');
    expect(formatNav((999995n * 10n ** 36n).toString())).toBe('$1.00M');
    expect(formatNav((999995n * 10n ** 33n).toString())).toBe('$1.00K');
    expect(formatNav('0')).toBe('$0.00');
  });
  it('keeps a previous browser reading stale after a cold server or network failure', () => {
    const metric = {
      status: 'available',
      value: '2',
      sourceAt: '2026-09-20T00:00:00.000Z',
      observedAt: '2026-09-20T00:01:00.000Z'
    } as const;
    expect(mergeMetric(metric, unavailableMetric)).toEqual({ ...metric, status: 'stale' });
    expect(mergeMetric(unavailableMetric, unavailableMetric)).toEqual(unavailableMetric);
  });
});
