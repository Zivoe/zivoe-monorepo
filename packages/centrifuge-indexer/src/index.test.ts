import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CentrifugeIndexerError,
  fetchCurrentShareMetrics,
  fetchDailyTokenSnapshots,
  getCentrifugeIndexerConfig
} from './index';

const sepolia = getCentrifugeIndexerConfig('sepolia');

function fakeIndexerResponse(body: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function shareMetricsPayload(token: Record<string, unknown>, yield30dComp365: string | null = null) {
  return {
    data: {
      tokenInstances: { items: [{ token }] },
      tokenSnapshots: { items: [{ yield30dComp365 }] }
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCentrifugeIndexerConfig', () => {
  it('returns the Sepolia constants', () => {
    expect(sepolia).toEqual({
      network: 'sepolia',
      chainId: 11155111,
      indexerUrl: 'https://api-v3-test.cfg.embrio.tech',
      shareTokenAddress: '0xc0cE8aFcb1D3299A3445575EA426c1b313298B4c',
      poolId: '281474976720680',
      scId: '0x00010000000027280000000000000001'
    });
  });

  it('refuses to hand out the non-deployable mainnet placeholder', () => {
    expect(() => getCentrifugeIndexerConfig('mainnet')).toThrow(/non-deployable placeholder/);
  });
});

describe('fetchCurrentShareMetrics', () => {
  it('maps the token entity to current share metrics', async () => {
    fakeIndexerResponse(
      shareMetricsPayload({
        tokenPrice: '1070000000000000000',
        tokenPriceComputedAt: '1783595010000',
        totalIssuance: '100000000000000000000',
        decimals: 18
      })
    );

    const metrics = await fetchCurrentShareMetrics({ config: sepolia });

    expect(metrics).toEqual({
      sharePrice: 1070000000000000000n,
      totalIssuance: 100000000000000000000n,
      nav: 107000000000000000000n,
      shareTokenDecimals: 18,
      priceComputedAt: new Date(1783595010000),
      yield30dComp365: null
    });
  });

  it('maps the newest snapshot yield when 30 days of history exist', async () => {
    fakeIndexerResponse(
      shareMetricsPayload(
        {
          tokenPrice: '1070000000000000000',
          tokenPriceComputedAt: '1783595010000',
          totalIssuance: '100000000000000000000',
          decimals: 18
        },
        '52500000000000000000000000'
      )
    );

    const metrics = await fetchCurrentShareMetrics({ config: sepolia });

    expect(metrics.yield30dComp365).toBe(52500000000000000000000000n);
  });

  it('accepts a negative trailing yield instead of failing the whole payload', async () => {
    fakeIndexerResponse(
      shareMetricsPayload(
        {
          tokenPrice: '1070000000000000000',
          tokenPriceComputedAt: '1783595010000',
          totalIssuance: '100000000000000000000',
          decimals: 18
        },
        '-52500000000000000000000000'
      )
    );

    const metrics = await fetchCurrentShareMetrics({ config: sepolia });

    expect(metrics.yield30dComp365).toBe(-52500000000000000000000000n);
    expect(metrics.nav).toBe(107000000000000000000n);
  });

  it('returns a null yield when no snapshot rows exist yet', async () => {
    fakeIndexerResponse({
      data: {
        tokenInstances: {
          items: [
            {
              token: {
                tokenPrice: '1070000000000000000',
                tokenPriceComputedAt: '1783595010000',
                totalIssuance: '0',
                decimals: 18
              }
            }
          ]
        },
        tokenSnapshots: { items: [] }
      }
    });

    const metrics = await fetchCurrentShareMetrics({ config: sepolia });

    expect(metrics.yield30dComp365).toBeNull();
  });

  it('queries the network indexer with the lowercased share token address', async () => {
    const fetchMock = fakeIndexerResponse(
      shareMetricsPayload({
        tokenPrice: '1000000000000000000',
        tokenPriceComputedAt: '1783595010000',
        totalIssuance: '0',
        decimals: 18
      })
    );

    await fetchCurrentShareMetrics({ config: sepolia });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(sepolia.indexerUrl);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).variables).toEqual({
      shareTokenAddress: sepolia.shareTokenAddress.toLowerCase(),
      tokenId: sepolia.scId
    });
  });

  it('throws a network error when the request cannot be sent at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(fetchCurrentShareMetrics({ config: sepolia })).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('fetch failed')
    });
  });

  it('throws an http error when the indexer responds with a failure status', async () => {
    fakeIndexerResponse({}, { status: 502 });

    const request = fetchCurrentShareMetrics({ config: sepolia });

    await expect(request).rejects.toBeInstanceOf(CentrifugeIndexerError);
    await expect(request).rejects.toMatchObject({ kind: 'http', status: 502 });
  });

  it('throws a graphql error when the response carries GraphQL errors', async () => {
    fakeIndexerResponse({ errors: [{ message: 'Unknown field "tokenPrice"' }] });

    await expect(fetchCurrentShareMetrics({ config: sepolia })).rejects.toMatchObject({
      kind: 'graphql',
      message: expect.stringContaining('Unknown field "tokenPrice"')
    });
  });

  it('throws a validation error when the share token is not indexed', async () => {
    fakeIndexerResponse({ data: { tokenInstances: { items: [] }, tokenSnapshots: { items: [] } } });

    await expect(fetchCurrentShareMetrics({ config: sepolia })).rejects.toMatchObject({
      kind: 'validation',
      message: expect.stringContaining('not indexed')
    });
  });

  it('throws a validation error on an unexpected response shape', async () => {
    fakeIndexerResponse(
      shareMetricsPayload({
        tokenPrice: 'not-a-number',
        tokenPriceComputedAt: '1783595010000',
        totalIssuance: '0',
        decimals: 18
      })
    );

    await expect(fetchCurrentShareMetrics({ config: sepolia })).rejects.toMatchObject({ kind: 'validation' });
  });

  it('throws a validation error on a non-JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>bad gateway</html>')));

    await expect(fetchCurrentShareMetrics({ config: sepolia })).rejects.toMatchObject({
      kind: 'validation',
      message: expect.stringContaining('non-JSON')
    });
  });
});

describe('fetchDailyTokenSnapshots', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  // 2026-07-01T00:00:00Z
  const day1 = 1782864000000;
  const day2 = day1 + DAY_MS;

  function snapshotRow({
    timestamp,
    tokenPrice = '1000000000000000000',
    totalIssuance = '100000000000000000000',
    yield30dComp365 = null
  }: {
    timestamp: number;
    tokenPrice?: string | null;
    totalIssuance?: string | null;
    yield30dComp365?: string | null;
  }) {
    return { timestamp: String(timestamp), tokenPrice, totalIssuance, yield30dComp365 };
  }

  it('dedupes to the last priced row per UTC day, returned oldest first', async () => {
    // Newest-first feed: two rows on day 2 (the later one wins), one on day 1.
    fakeIndexerResponse({
      data: {
        tokenSnapshots: {
          items: [
            snapshotRow({ timestamp: day2 + 2000, tokenPrice: '1200000000000000000' }),
            snapshotRow({ timestamp: day2 + 1000, tokenPrice: '1100000000000000000' }),
            snapshotRow({ timestamp: day1 + 1000, tokenPrice: '1050000000000000000', yield30dComp365: '-1' })
          ]
        }
      }
    });

    const { snapshots, truncated } = await fetchDailyTokenSnapshots({ config: sepolia });

    expect(truncated).toBe(false);
    expect(snapshots).toEqual([
      {
        dayStartSeconds: day1 / 1000,
        tokenPrice: 1050000000000000000n,
        totalIssuance: 100000000000000000000n,
        yield30dComp365: -1n
      },
      {
        dayStartSeconds: day2 / 1000,
        tokenPrice: 1200000000000000000n,
        totalIssuance: 100000000000000000000n,
        yield30dComp365: null
      }
    ]);
  });

  it('skips unpriced rows so an unpriced last row cannot mask an earlier priced one', async () => {
    fakeIndexerResponse({
      data: {
        tokenSnapshots: {
          items: [
            snapshotRow({ timestamp: day1 + 2000, tokenPrice: null }),
            snapshotRow({ timestamp: day1 + 1000, tokenPrice: '1050000000000000000' })
          ]
        }
      }
    });

    const { snapshots } = await fetchDailyTokenSnapshots({ config: sepolia });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.tokenPrice).toBe(1050000000000000000n);
  });

  it('flags truncation when the feed fills the indexer page cap', async () => {
    fakeIndexerResponse({
      data: {
        tokenSnapshots: {
          items: Array.from({ length: 1000 }, (_, index) => snapshotRow({ timestamp: day1 + index * DAY_MS }))
        }
      }
    });

    const { snapshots, truncated } = await fetchDailyTokenSnapshots({ config: sepolia });

    expect(truncated).toBe(true);
    expect(snapshots).toHaveLength(1000);
  });
});
