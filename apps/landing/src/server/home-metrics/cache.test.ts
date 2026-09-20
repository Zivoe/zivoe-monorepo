import { describe, expect, it, vi } from 'vitest';

import { createMetricSource } from './cache';

const reading = { value: '3', sourceAt: '2026-09-20T00:00:00.000Z', observedAt: '2026-09-20T00:01:00.000Z' };

describe('source cache', () => {
  it('coalesces reads, caches for 60 seconds, preserves successful timestamps and recovers', async () => {
    let now = 0;
    const read = vi.fn().mockResolvedValue({ nav: reading });
    const load = createMetricSource(['nav'], read, () => now);
    const [first, concurrent] = await Promise.all([load(), load()]);
    expect(first).toEqual(concurrent);
    now = 59_999;
    await load();
    expect(read).toHaveBeenCalledTimes(1);
    read.mockRejectedValueOnce(new Error('offline'));
    now = 60_000;
    expect(await load()).toEqual({ nav: { ...reading, status: 'stale' } });
    now = 119_999;
    await load();
    expect(read).toHaveBeenCalledTimes(2);
    now = 120_000;
    expect(await load()).toEqual({ nav: { ...reading, status: 'available' } });
  });
  it('returns unavailable metrics on an initial indexer failure, without invented zeros', async () => {
    const load = createMetricSource(['nav', 'tokenPrice'], async () => {
      throw new Error('indexer unavailable');
    });
    const unavailable = { status: 'unavailable', value: null, sourceAt: null, observedAt: null };
    expect(await load()).toEqual({ nav: unavailable, tokenPrice: unavailable });
  });
});
