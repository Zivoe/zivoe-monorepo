import { vi } from 'vitest';

/**
 * Stubs global fetch with an indexer-shaped JSON response. A FRESH Response is
 * built per call — a shared instance would fail any second fetch with "body
 * already read" instead of a meaningful assertion. Callers restore with
 * `vi.unstubAllGlobals()` in afterEach.
 */
export function fakeIndexerResponse(body: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), init)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
