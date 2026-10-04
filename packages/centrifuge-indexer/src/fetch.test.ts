import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { fetchCentrifugeIndexer } from './fetch';
import { graphql } from './graphql';

const options = {
  indexerUrl: 'https://indexer.example',
  query: graphql(`
    query RetryStatus {
      _meta {
        status
      }
    }
  `),
  dataSchema: z.object({ _meta: z.object({ status: z.string() }) })
};
const success = () => Response.json({ data: { _meta: { status: 'ready' } } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it.each([408, 425, 429, 500, 502, 503, 504])(
  'recovers from a transient HTTP %s without changing the request',
  async (status) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(success());
    vi.stubGlobal('fetch', fetchMock);
    const request = fetchCentrifugeIndexer(options);
    await vi.runAllTimersAsync();
    await expect(request).resolves.toEqual({ _meta: { status: 'ready' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
  }
);

it('recovers from a failed network connection', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(success());
  vi.stubGlobal('fetch', fetchMock);
  const request = fetchCentrifugeIndexer(options);
  await vi.runAllTimersAsync();
  await expect(request).resolves.toEqual({ _meta: { status: 'ready' } });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('stops after one retry when the indexer stays unavailable', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockImplementation(async () => new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  const assertion = expect(fetchCentrifugeIndexer(options)).rejects.toMatchObject({ kind: 'http', status: 503 });
  await vi.runAllTimersAsync();
  await assertion;
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each([400, 401, 403, 404, 422])('does not retry permanent HTTP %s errors', async (status) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
  vi.stubGlobal('fetch', fetchMock);
  await expect(fetchCentrifugeIndexer(options)).rejects.toMatchObject({ kind: 'http', status });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([
  { response: () => Response.json({ errors: [{ message: 'Invalid query' }] }), kind: 'graphql' },
  { response: () => Response.json({ data: { _meta: { status: 123 } } }), kind: 'validation' },
  { response: () => new Response('<html>invalid</html>'), kind: 'validation' }
])('does not retry a $kind error', async ({ response, kind }) => {
  const fetchMock = vi.fn().mockResolvedValue(response());
  vi.stubGlobal('fetch', fetchMock);
  await expect(fetchCentrifugeIndexer(options)).rejects.toMatchObject({ kind });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('does not retry a cancelled request', async () => {
  const controller = new AbortController();
  const fetchMock = vi.fn().mockImplementation(async () => {
    controller.abort();
    throw controller.signal.reason;
  });
  vi.stubGlobal('fetch', fetchMock);
  await expect(
    fetchCentrifugeIndexer({ ...options, fetchOptions: { signal: controller.signal } })
  ).rejects.toMatchObject({
    kind: 'network'
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('cancels the retry delay immediately when the caller aborts', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  const assertion = expect(
    fetchCentrifugeIndexer({ ...options, fetchOptions: { signal: controller.signal } })
  ).rejects.toMatchObject({ kind: 'http', status: 503 });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await assertion;
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('shares one ten-second timeout across both attempts', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
    return controller.signal;
  });
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('Timed out', 'TimeoutError')), {
            once: true
          });
        })
    );
  vi.stubGlobal('fetch', fetchMock);
  const assertion = expect(fetchCentrifugeIndexer(options)).rejects.toMatchObject({ kind: 'network' });
  await vi.advanceTimersByTimeAsync(10_000);
  await assertion;
  expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0]![1].signal).toBe(fetchMock.mock.calls[1]![1].signal);
});
