import { type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getQueryClient } from './get-query-client';

const captureException = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureException }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));

// One client per test: on the server (this file runs in node) getQueryClient
// hands out a fresh client per call, and the repeat-failure rule is per query.
let queryClient: QueryClient;
beforeEach(() => {
  queryClient = getQueryClient();
});
afterEach(() => {
  captureException.mockClear();
  queryClient.clear();
});

describe('query cache error reporting', () => {
  const fail = (queryKey: Array<string>, meta?: Record<string, unknown>) =>
    queryClient
      .fetchQuery({ queryKey, meta, retry: false, staleTime: 0, queryFn: () => Promise.reject(new Error('rpc down')) })
      .catch(() => undefined);

  it('tags a capture with the chain the query key carries', async () => {
    await fail(['ACCOUNT', '0xabc', 'BALANCE', 'avalanche', '0xdef']);

    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { source: 'QUERY', chain: 'avalanche' }
    });
  });

  it('captures a silent read once, not again on each of its own retries', async () => {
    const key = ['ACCOUNT', '0xabc', 'REDEMPTION_POSITION', 'zsmb', 'monad', '0xdef'];
    await fail(key, { skipErrorToast: true });
    await fail(key, { skipErrorToast: true });
    await fail(key, { skipErrorToast: true });

    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('captures a silent read again once it has recovered and fails anew', async () => {
    const key = ['ACCOUNT', '0xabc', 'BALANCE', 'bnb', '0xdef'];
    await fail(key, { skipErrorToast: true });
    await queryClient.fetchQuery({
      queryKey: key,
      meta: { skipErrorToast: true },
      retry: false,
      staleTime: 0,
      queryFn: () => Promise.resolve(1n)
    });
    await fail(key, { skipErrorToast: true });

    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('keeps capturing every failure of a read that toasts', async () => {
    const key = ['ACCOUNT', '0xabc', 'ALLOWANCE', 'base', '0x1', '0x2'];
    await fail(key);
    await fail(key);

    expect(captureException).toHaveBeenCalledTimes(2);
  });
});
