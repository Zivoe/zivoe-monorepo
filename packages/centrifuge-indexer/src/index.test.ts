import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CENTRIFUGE_ENVIRONMENT_FACTS,
  CentrifugeIndexerError,
  type CurrentShareMetrics,
  assertShareClassCatalogInvariants,
  chainsOfEnvironment,
  createDailyNegativeYieldReporter,
  fetchCurrentShareMetrics,
  fetchDailyTokenSnapshots,
  fetchShareClassNavs,
  getShareClassChainIdentity,
  getShareClassIdentity,
  listShareClassKeys,
  rayToPercent,
  sumShareClassNavs,
  toShareStatsPayload
} from './index';

const sepolia = {
  ...getShareClassChainIdentity({ chain: 'sepolia', key: 'zsmb' }),
  indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS.testnet.indexerUrl
};

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

describe('environment/chain facts', () => {
  it('partitions every chain into exactly one environment', () => {
    expect(chainsOfEnvironment('mainnet')).toEqual(['ethereum', 'pharos']);
    expect(chainsOfEnvironment('testnet')).toEqual(['sepolia', 'base-sepolia']);
  });
});

describe('share-class catalog', () => {
  it('resolves a live entry to its hub-level identity — no chain-scoped fields', () => {
    expect(getShareClassIdentity({ environment: 'testnet', key: 'zsmb' })).toEqual({
      key: 'zsmb',
      symbol: 'zSMB',
      decimals: 18,
      poolId: '281474976720680',
      scId: '0x00010000000027280000000000000002'
    });
  });

  it('resolves a live chain entry to the identity joined with the chain instance', () => {
    expect(getShareClassChainIdentity({ chain: 'sepolia', key: 'zsmb' })).toEqual({
      key: 'zsmb',
      symbol: 'zSMB',
      decimals: 18,
      poolId: '281474976720680',
      scId: '0x00010000000027280000000000000002',
      chain: 'sepolia',
      chainId: 11155111,
      shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6'
    });
  });

  it('resolves the second mainnet chain with its deterministically shared token address', () => {
    expect(getShareClassChainIdentity({ chain: 'pharos', key: 'zsmb' })).toEqual({
      key: 'zsmb',
      symbol: 'zSMB',
      decimals: 18,
      poolId: '281474976710674',
      scId: '0x00010000000000120000000000000002',
      chain: 'pharos',
      chainId: 1672,
      shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8'
    });
  });

  it('resolves the second testnet chain with its deterministically shared token address', () => {
    expect(getShareClassChainIdentity({ chain: 'base-sepolia', key: 'zsmb' })).toEqual({
      key: 'zsmb',
      symbol: 'zSMB',
      decimals: 18,
      poolId: '281474976720680',
      scId: '0x00010000000027280000000000000002',
      chain: 'base-sepolia',
      chainId: 84532,
      shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6'
    });
  });

  it('rejects prototype-chain keys with the boundary error, not a TypeError', () => {
    for (const key of ['toString', '__proto__', 'constructor']) {
      expect(() => getShareClassIdentity({ environment: 'testnet', key })).toThrow(/not in the catalog/);
      expect(() => getShareClassChainIdentity({ chain: 'sepolia', key })).toThrow(/not in the catalog/);
    }
  });

  it('lists only live share classes', () => {
    // Synthetic catalog on purpose: enumerating the real book here made
    // registering a share class break this file (it happened once).
    const catalog = {
      live: { environments: { testnet: { chains: { sepolia: { deployable: true } } } } },
      staged: {
        environments: {
          testnet: { chains: { sepolia: { deployable: false }, 'base-sepolia': { deployable: false } } },
          mainnet: { chains: { ethereum: { deployable: false } } }
        }
      }
    };

    expect(listShareClassKeys('testnet', catalog)).toEqual(['live']);
    expect(listShareClassKeys('mainnet', catalog)).toEqual([]);
  });

  it('keeps the original class listed on its live environment', () => {
    // Membership only — the whole book is deliberately not asserted.
    expect(listShareClassKeys('testnet')).toContain('zsmb');
  });
});

describe('assertShareClassCatalogInvariants', () => {
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const ZERO_SC_ID = '0x00000000000000000000000000000000';

  function entry({
    symbol,
    scId,
    shareTokenAddress,
    environment = 'testnet',
    chain = 'sepolia',
    deployable = true
  }: {
    symbol: string;
    scId: string;
    shareTokenAddress: string;
    environment?: 'testnet' | 'mainnet';
    chain?: 'sepolia' | 'base-sepolia' | 'ethereum' | 'pharos';
    deployable?: boolean;
  }) {
    return {
      symbol,
      decimals: 18,
      environments: { [environment]: { scId, chains: { [chain]: { shareTokenAddress, deployable } } } }
    };
  }

  const first = entry({
    symbol: 'zAAA',
    scId: '0x000100000000aaaa0000000000000001',
    shareTokenAddress: '0xabababababababababababababababababababab'
  });

  it('accepts distinct entries, including shared placeholder zeros on staged chains', () => {
    const staged = (base: ReturnType<typeof entry>) => ({
      ...base,
      environments: {
        ...base.environments,
        mainnet: {
          scId: ZERO_SC_ID,
          chains: { ethereum: { shareTokenAddress: ZERO_ADDRESS, deployable: false } }
        }
      }
    });

    expect(() =>
      assertShareClassCatalogInvariants({
        a: staged(first),
        b: staged(
          entry({
            symbol: 'zBBB',
            scId: '0x000100000000bbbb0000000000000001',
            shareTokenAddress: '0xbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc'
          })
        )
      })
    ).not.toThrow();
  });

  it('accepts one address reused across two chains — deterministic deploys are legitimate', () => {
    const address = '0xabababababababababababababababababababab';

    expect(() =>
      assertShareClassCatalogInvariants({
        a: {
          symbol: 'zAAA',
          decimals: 18,
          environments: {
            testnet: {
              scId: '0x000100000000aaaa0000000000000001',
              chains: {
                sepolia: { shareTokenAddress: address, deployable: true },
                'base-sepolia': { shareTokenAddress: address, deployable: true }
              }
            }
          }
        }
      })
    ).not.toThrow();
  });

  it('throws on implausible decimals', () => {
    expect(() => assertShareClassCatalogInvariants({ a: { ...first, decimals: 8.5 } })).toThrow(/implausible decimals/);
    expect(() => assertShareClassCatalogInvariants({ a: { ...first, decimals: 180 } })).toThrow(/implausible decimals/);
  });

  it('throws on a mixed-case scId — query sites send it verbatim', () => {
    expect(() =>
      assertShareClassCatalogInvariants({
        a: entry({
          symbol: 'zAAA',
          scId: '0x000100000000AAAA0000000000000001',
          shareTokenAddress: '0xabababababababababababababababababababab'
        })
      })
    ).toThrow(/lowercase/);
  });

  it('throws when a chain is filed under the wrong environment', () => {
    expect(() =>
      assertShareClassCatalogInvariants({
        a: entry({
          symbol: 'zAAA',
          scId: '0x000100000000aaaa0000000000000001',
          shareTokenAddress: '0xabababababababababababababababababababab',
          environment: 'mainnet',
          chain: 'sepolia'
        })
      })
    ).toThrow(/belongs to "testnet"/);
  });

  it('throws when a deployable chain carries a placeholder address — a flipped flag, not a staged launch', () => {
    expect(() =>
      assertShareClassCatalogInvariants({
        a: entry({
          symbol: 'zAAA',
          scId: '0x000100000000aaaa0000000000000001',
          shareTokenAddress: ZERO_ADDRESS,
          deployable: true
        })
      })
    ).toThrow(/deployable but carries a placeholder/);
  });

  it('throws when two entries share a symbol, compared case-insensitively', () => {
    expect(() =>
      assertShareClassCatalogInvariants({
        a: first,
        b: entry({
          // Case-shifted on purpose: two case-variant symbols read as one product.
          symbol: 'ZaAa',
          scId: '0x000100000000bbbb0000000000000001',
          shareTokenAddress: '0xbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc'
        })
      })
    ).toThrow(/symbol .* is claimed by two share classes/);
  });

  it('throws on a duplicate share-class id per environment, including a non-active one', () => {
    const onMainnet = (symbol: string, shareTokenAddress: string) =>
      entry({
        symbol,
        scId: '0x000100000000dddd0000000000000001',
        shareTokenAddress,
        environment: 'mainnet',
        chain: 'ethereum'
      });

    expect(() =>
      assertShareClassCatalogInvariants({
        a: onMainnet('zAAA', '0xabababababababababababababababababababab'),
        b: onMainnet('zBBB', '0xbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc')
      })
    ).toThrow(/claimed by two catalog entries on "mainnet"/);
  });

  it('compares share-token addresses case-insensitively, per chain', () => {
    expect(() =>
      assertShareClassCatalogInvariants({
        a: first,
        b: entry({
          symbol: 'zBBB',
          scId: '0x000100000000bbbb0000000000000001',
          // Case-shifted on purpose: identity comparisons must be case-insensitive.
          shareTokenAddress: '0xabababababababababababababababababababab'.toUpperCase()
        })
      })
    ).toThrow(/Share token .* is claimed by two share classes/);
  });
});

describe('fetchShareClassNavs', () => {
  it('maps each requested class to its own nav, filtering by all share-class ids', async () => {
    const fetchMock = fakeIndexerResponse({
      data: {
        tokenInstances: {
          items: [
            {
              tokenId: sepolia.scId,
              token: { tokenPrice: '1070000000000000000', totalIssuance: '100000000000000000000', decimals: 18 }
            }
          ]
        }
      }
    });

    const navs = await fetchShareClassNavs({ environment: 'testnet', shareClassKeys: ['zsmb'] });

    expect(navs).toEqual({ zsmb: '107000000000000000000' });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).variables).toEqual({ tokenIds: [sepolia.scId] });
  });

  it('tolerates duplicate rows with identical payloads — one TokenInstance per spoke chain', async () => {
    const row = {
      tokenId: sepolia.scId,
      token: { tokenPrice: '1070000000000000000', totalIssuance: '100000000000000000000', decimals: 18 }
    };
    fakeIndexerResponse({ data: { tokenInstances: { items: [row, row] } } });

    await expect(fetchShareClassNavs({ environment: 'testnet', shareClassKeys: ['zsmb'] })).resolves.toEqual({
      zsmb: '107000000000000000000'
    });
  });

  it('fails the whole read when duplicate rows disagree, instead of letting one silently win', async () => {
    const row = {
      tokenId: sepolia.scId,
      token: { tokenPrice: '1070000000000000000', totalIssuance: '100000000000000000000', decimals: 18 }
    };
    const conflicting = { ...row, token: { ...row.token, tokenPrice: '9990000000000000000' } };
    fakeIndexerResponse({ data: { tokenInstances: { items: [row, conflicting] } } });

    await expect(fetchShareClassNavs({ environment: 'testnet', shareClassKeys: ['zsmb'] })).rejects.toMatchObject({
      kind: 'validation',
      message: expect.stringContaining('conflicting share-token rows')
    });
  });

  it('fails the whole read when a requested class is missing, instead of returning a partial map', async () => {
    fakeIndexerResponse({ data: { tokenInstances: { items: [] } } });

    await expect(fetchShareClassNavs({ environment: 'testnet', shareClassKeys: ['zsmb'] })).rejects.toMatchObject({
      kind: 'validation',
      message: expect.stringContaining('is not indexed')
    });
  });

  it('fails the whole read when any class is unpriced, instead of summing a partial book', async () => {
    fakeIndexerResponse({
      data: {
        tokenInstances: {
          items: [
            {
              tokenId: sepolia.scId,
              token: { tokenPrice: null, totalIssuance: '100000000000000000000', decimals: 18 }
            }
          ]
        }
      }
    });

    await expect(fetchShareClassNavs({ environment: 'testnet', shareClassKeys: ['zsmb'] })).rejects.toMatchObject({
      kind: 'validation'
    });
  });

  it('returns an empty map without fetching when no classes are requested', async () => {
    const fetchMock = fakeIndexerResponse({});

    await expect(fetchShareClassNavs({ environment: 'testnet', shareClassKeys: [] })).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sumShareClassNavs', () => {
  it('sums every class into one book value as bigint', () => {
    expect(sumShareClassNavs({ zsmb: '107000000000000000000', other: '3000000000000000000' })).toBe(
      110000000000000000000n
    );
  });

  it('returns null for an empty book so no surface renders it as $0', () => {
    expect(sumShareClassNavs({})).toBeNull();
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

    const metrics = await fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' });

    expect(metrics).toEqual({
      sharePrice: 1070000000000000000n,
      totalIssuance: 100000000000000000000n,
      nav: 107000000000000000000n,
      shareTokenDecimals: 18,
      priceComputedAt: new Date(1783595010000),
      yield30dComp365: null
    });
  });

  it('tolerates duplicate rows with identical payloads — one TokenInstance per spoke chain', async () => {
    const token = {
      tokenPrice: '1070000000000000000',
      tokenPriceComputedAt: '1783595010000',
      totalIssuance: '100000000000000000000',
      decimals: 18
    };
    fakeIndexerResponse({
      data: {
        tokenInstances: { items: [{ token }, { token }] },
        tokenSnapshots: { items: [] }
      }
    });

    await expect(fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' })).resolves.toMatchObject({
      sharePrice: 1070000000000000000n
    });
  });

  it('fails the read when duplicate rows disagree, instead of an arbitrary chain winning', async () => {
    const token = {
      tokenPrice: '1070000000000000000',
      tokenPriceComputedAt: '1783595010000',
      totalIssuance: '100000000000000000000',
      decimals: 18
    };
    fakeIndexerResponse({
      data: {
        tokenInstances: { items: [{ token }, { token: { ...token, tokenPrice: '9990000000000000000' } }] },
        tokenSnapshots: { items: [] }
      }
    });

    await expect(fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' })).rejects.toMatchObject({
      kind: 'validation',
      message: expect.stringContaining('conflicting share-token rows')
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

    const metrics = await fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' });

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

    const metrics = await fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' });

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

    const metrics = await fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' });

    expect(metrics.yield30dComp365).toBeNull();
  });

  it('queries the environment indexer by the hub-level share-class id', async () => {
    const fetchMock = fakeIndexerResponse(
      shareMetricsPayload({
        tokenPrice: '1000000000000000000',
        tokenPriceComputedAt: '1783595010000',
        totalIssuance: '0',
        decimals: 18
      })
    );

    await fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(sepolia.indexerUrl);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).variables).toEqual({ tokenId: sepolia.scId });
  });

  it('applies a default timeout signal so a hung indexer cannot stall the caller', async () => {
    const fetchMock = fakeIndexerResponse(
      shareMetricsPayload({
        tokenPrice: '1000000000000000000',
        tokenPriceComputedAt: '1783595010000',
        totalIssuance: '0',
        decimals: 18
      })
    );

    await fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('prefers a caller-provided abort signal over the default timeout', async () => {
    const fetchMock = fakeIndexerResponse(
      shareMetricsPayload({
        tokenPrice: '1000000000000000000',
        tokenPriceComputedAt: '1783595010000',
        totalIssuance: '0',
        decimals: 18
      })
    );

    const controller = new AbortController();
    await fetchCurrentShareMetrics({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      fetchOptions: { signal: controller.signal }
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it('throws a network error when the request cannot be sent at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' })).rejects.toMatchObject({
      kind: 'network',
      message: expect.stringContaining('fetch failed')
    });
  });

  it('throws an http error when the indexer responds with a failure status', async () => {
    fakeIndexerResponse({}, { status: 502 });

    const request = fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' });

    await expect(request).rejects.toBeInstanceOf(CentrifugeIndexerError);
    await expect(request).rejects.toMatchObject({ kind: 'http', status: 502 });
  });

  it('throws a graphql error when the response carries GraphQL errors', async () => {
    fakeIndexerResponse({ errors: [{ message: 'Unknown field "tokenPrice"' }] });

    await expect(fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' })).rejects.toMatchObject({
      kind: 'graphql',
      message: expect.stringContaining('Unknown field "tokenPrice"')
    });
  });

  it('throws a validation error when the share class is not indexed', async () => {
    fakeIndexerResponse({ data: { tokenInstances: { items: [] }, tokenSnapshots: { items: [] } } });

    await expect(fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' })).rejects.toMatchObject({
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

    await expect(fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' })).rejects.toMatchObject({
      kind: 'validation'
    });
  });

  it('throws a validation error when the published share price is zero', async () => {
    fakeIndexerResponse(
      shareMetricsPayload({
        tokenPrice: '0',
        tokenPriceComputedAt: '1783595010000',
        totalIssuance: '100000000000000000000',
        decimals: 18
      })
    );

    await expect(fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' })).rejects.toMatchObject({
      kind: 'validation'
    });
  });

  it('throws a validation error on a non-JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>bad gateway</html>')));

    await expect(fetchCurrentShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb' })).rejects.toMatchObject({
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

    const { snapshots, truncated } = await fetchDailyTokenSnapshots({
      environment: 'testnet',
      shareClassKey: 'zsmb'
    });

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

  it("attributes a midnight NewPeriod row to the day it closes, superseding that day's intraday rows", async () => {
    // The live indexer stamps NewPeriod snapshots exactly at UTC midnight with
    // the state at rollover — the previous day's close.
    fakeIndexerResponse({
      data: {
        tokenSnapshots: {
          items: [
            snapshotRow({ timestamp: day2, tokenPrice: '1070000000000000000' }),
            snapshotRow({ timestamp: day1 + 14 * 60 * 60 * 1000, tokenPrice: '1050000000000000000' })
          ]
        }
      }
    });

    const { snapshots } = await fetchDailyTokenSnapshots({ environment: 'testnet', shareClassKey: 'zsmb' });

    // Day 1's point is its close (the midnight row), and day 2 has no row yet.
    expect(snapshots).toEqual([
      {
        dayStartSeconds: day1 / 1000,
        tokenPrice: 1070000000000000000n,
        totalIssuance: 100000000000000000000n,
        yield30dComp365: null
      }
    ]);
  });

  it('buckets a run of midnight rows to their closing days, mirroring the live indexer feed', async () => {
    const day3 = day2 + DAY_MS;

    // Newest-first: NewPeriod at day-3 and day-2 midnights plus a price event
    // during day 1 that the day-2 midnight row supersedes.
    fakeIndexerResponse({
      data: {
        tokenSnapshots: {
          items: [
            snapshotRow({ timestamp: day3, tokenPrice: '1090000000000000000' }),
            snapshotRow({ timestamp: day2, tokenPrice: '1070000000000000000' }),
            snapshotRow({ timestamp: day1 + 11 * 60 * 60 * 1000, tokenPrice: '1000000000000000000' })
          ]
        }
      }
    });

    const { snapshots } = await fetchDailyTokenSnapshots({ environment: 'testnet', shareClassKey: 'zsmb' });

    expect(snapshots.map((snapshot) => [snapshot.dayStartSeconds, snapshot.tokenPrice])).toEqual([
      [day1 / 1000, 1070000000000000000n],
      [day2 / 1000, 1090000000000000000n]
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

    const { snapshots } = await fetchDailyTokenSnapshots({ environment: 'testnet', shareClassKey: 'zsmb' });

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

    const { snapshots, truncated } = await fetchDailyTokenSnapshots({
      environment: 'testnet',
      shareClassKey: 'zsmb'
    });

    expect(truncated).toBe(true);
    expect(snapshots).toHaveLength(1000);
  });
});

describe('rayToPercent', () => {
  it('converts Ray-scale yields to display percent, preserving sign', () => {
    expect(rayToPercent(50000000000000000000000000n)).toBe(5);
    expect(rayToPercent(-1250000000000000000000000n)).toBe(-0.125);
    expect(rayToPercent(0n)).toBe(0);
  });
});

describe('toShareStatsPayload', () => {
  const base: CurrentShareMetrics = {
    sharePrice: 1070000000000000000n,
    totalIssuance: 100000000000000000000n,
    nav: 107000000000000000000n,
    shareTokenDecimals: 18,
    priceComputedAt: new Date(1783595010000),
    yield30dComp365: null
  };

  it('projects D18 values as strings with a null yield passed through', () => {
    const { payload, negativeYield30d } = toShareStatsPayload(base);

    expect(payload).toEqual({
      sharePriceD18: '1070000000000000000',
      navD18: '107000000000000000000',
      apy: null,
      priceComputedAtMs: 1783595010000
    });
    expect(negativeYield30d).toBeNull();
  });

  it('converts a positive trailing yield to display percent', () => {
    const { payload, negativeYield30d } = toShareStatsPayload({
      ...base,
      yield30dComp365: 52500000000000000000000000n
    });

    expect(payload.apy).toBe(5.25);
    expect(negativeYield30d).toBeNull();
  });

  it('nulls an anomalous negative yield and surfaces the raw value for reporting', () => {
    const { payload, negativeYield30d } = toShareStatsPayload({ ...base, yield30dComp365: -1n });

    expect(payload.apy).toBeNull();
    expect(negativeYield30d).toBe(-1n);
  });
});

describe('createDailyNegativeYieldReporter', () => {
  it('reports at most once per UTC day while the anomaly persists', () => {
    const report = vi.fn();
    const reportNegativeYield = createDailyNegativeYieldReporter(report);

    reportNegativeYield({ shareClassKey: 'zsmb', negativeYield30d: null, now: new Date('2026-07-22T23:59:58Z') });
    reportNegativeYield({ shareClassKey: 'zsmb', negativeYield30d: -1n, now: new Date('2026-07-22T23:59:59Z') });
    reportNegativeYield({ shareClassKey: 'zsmb', negativeYield30d: -2n, now: new Date('2026-07-22T23:59:59.999Z') });
    reportNegativeYield({ shareClassKey: 'zsmb', negativeYield30d: -3n, now: new Date('2026-07-23T00:00:00Z') });

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenNthCalledWith(1, { shareClassKey: 'zsmb', negativeYield30d: -1n });
    expect(report).toHaveBeenNthCalledWith(2, { shareClassKey: 'zsmb', negativeYield30d: -3n });
  });

  it('dedupes per share class, so one class cannot suppress another', () => {
    const report = vi.fn();
    const reportNegativeYield = createDailyNegativeYieldReporter(report);
    const now = new Date('2026-07-22T12:00:00Z');

    reportNegativeYield({ shareClassKey: 'zsmb', negativeYield30d: -1n, now });
    reportNegativeYield({ shareClassKey: 'zother', negativeYield30d: -2n, now });
    reportNegativeYield({ shareClassKey: 'zother', negativeYield30d: -2n, now });

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenNthCalledWith(1, { shareClassKey: 'zsmb', negativeYield30d: -1n });
    expect(report).toHaveBeenNthCalledWith(2, { shareClassKey: 'zother', negativeYield30d: -2n });
  });
});
