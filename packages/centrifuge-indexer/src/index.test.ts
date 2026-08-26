import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CENTRIFUGE_CHAINS,
  CENTRIFUGE_ENVIRONMENT_FACTS,
  CentrifugeIndexerError,
  type CurrentShareMetrics,
  assertShareClassInvariants,
  chainsOfEnvironment,
  createDailyNegativeYieldReporter,
  fetchCurrentShareMetrics,
  fetchDailyTokenSnapshots,
  fetchShareClassNavs,
  getChainId,
  getShareClassChainIdentity,
  getShareClassIdentity,
  listLiveChains,
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

describe('chain deployments', () => {
  it('partitions every chain into exactly one environment, in canonical order', () => {
    expect(chainsOfEnvironment('mainnet')).toEqual(['ethereum', 'pharos']);
    expect(chainsOfEnvironment('testnet')).toEqual(['sepolia', 'base-sepolia']);
    expect([...chainsOfEnvironment('mainnet'), ...chainsOfEnvironment('testnet')].sort()).toEqual(
      [...CENTRIFUGE_CHAINS].sort()
    );
  });

  it('reads the chain id off the viem definition — one author for the fact', () => {
    expect(getChainId('ethereum')).toBe(1);
    expect(getChainId('pharos')).toBe(1672);
    expect(getChainId('sepolia')).toBe(11155111);
    expect(getChainId('base-sepolia')).toBe(84532);
  });

  it('keeps the real catalog lint-clean', () => {
    expect(() => assertShareClassInvariants()).not.toThrow();
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
      shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
      centrifugeVaultAddress: '0x7Bfa3382eC44e2279BBf0c555B87702fbbFf3AD6'
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
      shareTokenAddress: '0x49C8919162daE24468965557C9344bA2aa8121b8',
      centrifugeVaultAddress: '0x63D2b3596510b95CF02D921f21BaC19d31c9A4c6'
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
      shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6',
      centrifugeVaultAddress: '0x8aBb393C433375401EEeae24557475C3f36f5025'
    });
  });

  it('rejects prototype-chain keys with the boundary error, not a TypeError', () => {
    for (const key of ['toString', '__proto__', 'constructor']) {
      expect(() => getShareClassIdentity({ environment: 'testnet', key })).toThrow(/not in the catalog/);
      expect(() => getShareClassChainIdentity({ chain: 'sepolia', key })).toThrow(/not in the catalog/);
      expect(listLiveChains({ environment: 'testnet', key })).toEqual([]);
    }
  });

  // Synthetic catalog on purpose: enumerating the real book here made
  // registering a share class break this file (it happened once).
  const book = {
    live: {
      symbol: 'zLIV',
      decimals: 18,
      environments: {
        testnet: {
          poolId: '1',
          scId: '0x000100000000aaaa0000000000000001',
          chains: {
            sepolia: { status: 'live', shareTokenAddress: '0xab', centrifugeVaultAddress: '0xcd' },
            'base-sepolia': { status: 'staged' }
          }
        }
      }
    },
    staged: {
      symbol: 'zSTG',
      decimals: 18,
      environments: {
        testnet: {
          poolId: '2',
          scId: '0x000100000000bbbb0000000000000001',
          chains: { sepolia: { status: 'staged' }, 'base-sepolia': { status: 'staged' } }
        },
        mainnet: {
          poolId: '3',
          scId: '0x000100000000bbbb0000000000000001',
          chains: { ethereum: { status: 'staged' } }
        }
      }
    }
  } as const;

  it('lists only live share classes', () => {
    expect(listShareClassKeys('testnet', book)).toEqual(['live']);
    expect(listShareClassKeys('mainnet', book)).toEqual([]);
  });

  it('lists only the live chains of a class, in canonical order', () => {
    expect(listLiveChains({ environment: 'testnet', key: 'live' }, book)).toEqual(['sepolia']);
    expect(listLiveChains({ environment: 'testnet', key: 'staged' }, book)).toEqual([]);
    expect(listLiveChains({ environment: 'mainnet', key: 'live' }, book)).toEqual([]);
  });

  it('keeps the original class listed on its live environment', () => {
    // Membership only — the whole book is deliberately not asserted.
    expect(listShareClassKeys('testnet')).toContain('zsmb');
    expect(listLiveChains({ environment: 'testnet', key: 'zsmb' })).toContain('sepolia');
  });
});

describe('assertShareClassInvariants', () => {
  function entry({
    symbol,
    scId,
    shareTokenAddress,
    centrifugeVaultAddress = '0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
    environment = 'testnet',
    chain = 'sepolia'
  }: {
    symbol: string;
    scId: string;
    shareTokenAddress: string;
    centrifugeVaultAddress?: string;
    environment?: 'testnet' | 'mainnet';
    chain?: 'sepolia' | 'base-sepolia' | 'ethereum' | 'pharos';
  }) {
    return {
      symbol,
      decimals: 18,
      environments: {
        [environment]: {
          poolId: '1',
          scId,
          chains: { [chain]: { status: 'live' as const, shareTokenAddress, centrifugeVaultAddress } }
        }
      }
    };
  }

  const first = entry({
    symbol: 'zAAA',
    scId: '0x000100000000aaaa0000000000000001',
    shareTokenAddress: '0xabababababababababababababababababababab'
  });

  it('accepts distinct entries, including a staged chain beside a live one', () => {
    expect(() =>
      assertShareClassInvariants({
        a: {
          ...first,
          environments: {
            testnet: {
              poolId: '1',
              scId: '0x000100000000aaaa0000000000000001',
              chains: { ...first.environments.testnet?.chains, 'base-sepolia': { status: 'staged' } }
            }
          }
        },
        b: entry({
          symbol: 'zBBB',
          scId: '0x000100000000bbbb0000000000000001',
          shareTokenAddress: '0xbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc',
          centrifugeVaultAddress: '0xdededededededededededededededededededede'
        })
      })
    ).not.toThrow();
  });

  it('accepts one address reused across two chains — deterministic deploys are legitimate', () => {
    const address = '0xabababababababababababababababababababab';
    const onChain = { status: 'live' as const, shareTokenAddress: address, centrifugeVaultAddress: address };

    expect(() =>
      assertShareClassInvariants({
        a: {
          symbol: 'zAAA',
          decimals: 18,
          environments: {
            testnet: {
              poolId: '1',
              scId: '0x000100000000aaaa0000000000000001',
              chains: { sepolia: onChain, 'base-sepolia': onChain }
            }
          }
        }
      })
    ).not.toThrow();
  });

  it('throws on implausible decimals', () => {
    expect(() => assertShareClassInvariants({ a: { ...first, decimals: 8.5 } })).toThrow(/implausible decimals/);
    expect(() => assertShareClassInvariants({ a: { ...first, decimals: 180 } })).toThrow(/implausible decimals/);
  });

  it('throws on a placeholder or malformed pool id', () => {
    const withPoolId = (poolId: string) => ({
      a: { ...first, environments: { testnet: { ...first.environments.testnet!, poolId } } }
    });

    expect(() => assertShareClassInvariants(withPoolId('0'))).toThrow(/implausible pool id/);
    expect(() => assertShareClassInvariants(withPoolId('028147'))).toThrow(/implausible pool id/);
    expect(() => assertShareClassInvariants(withPoolId('28147x'))).toThrow(/implausible pool id/);
  });

  it('throws on a zero or truncated scId', () => {
    const withScId = (scId: string) =>
      entry({ symbol: 'zAAA', scId, shareTokenAddress: '0xabababababababababababababababababababab' });

    expect(() => assertShareClassInvariants({ a: withScId('0x00000000000000000000000000000000') })).toThrow(
      /implausible scId/
    );
    expect(() => assertShareClassInvariants({ a: withScId('0x0001000000000012') })).toThrow(/implausible scId/);
  });

  it('throws on a zero or truncated live address — Address only types the 0x prefix', () => {
    expect(() =>
      assertShareClassInvariants({
        a: entry({ symbol: 'zAAA', scId: '0x000100000000aaaa0000000000000001', shareTokenAddress: '0xab' })
      })
    ).toThrow(/implausible share token address/);

    expect(() =>
      assertShareClassInvariants({
        a: entry({
          symbol: 'zAAA',
          scId: '0x000100000000aaaa0000000000000001',
          shareTokenAddress: '0xabababababababababababababababababababab',
          centrifugeVaultAddress: '0x0000000000000000000000000000000000000000'
        })
      })
    ).toThrow(/implausible Centrifuge vault address/);
  });

  it('throws on a mixed-case scId — query sites send it verbatim', () => {
    expect(() =>
      assertShareClassInvariants({
        a: entry({
          symbol: 'zAAA',
          scId: '0x000100000000AAAA0000000000000001',
          shareTokenAddress: '0xabababababababababababababababababababab'
        })
      })
    ).toThrow(/lowercase/);
  });

  it('throws when two entries share a symbol, compared case-insensitively', () => {
    expect(() =>
      assertShareClassInvariants({
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
      assertShareClassInvariants({
        a: onMainnet('zAAA', '0xabababababababababababababababababababab'),
        b: onMainnet('zBBB', '0xbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc')
      })
    ).toThrow(/claimed by two catalog entries on "mainnet"/);
  });

  it('compares share-token addresses case-insensitively, per chain', () => {
    expect(() =>
      assertShareClassInvariants({
        a: first,
        b: entry({
          symbol: 'zBBB',
          scId: '0x000100000000bbbb0000000000000001',
          // Case-shifted on purpose (prefix kept lowercase — 0X would fail the
          // shape lint): identity comparisons must be case-insensitive.
          shareTokenAddress: '0xabababababababababababababababababababab'.toUpperCase().replace('0X', '0x'),
          centrifugeVaultAddress: '0xdededededededededededededededededededede'
        })
      })
    ).toThrow(/Share token .* is claimed by two share classes/);
  });

  it("throws when two share classes share a Centrifuge vault on one chain — they would decode each other's receipts", () => {
    expect(() =>
      assertShareClassInvariants({
        a: first,
        b: entry({
          symbol: 'zBBB',
          scId: '0x000100000000bbbb0000000000000001',
          shareTokenAddress: '0xbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc',
          // Case-shifted with the prefix kept lowercase, as above.
          centrifugeVaultAddress: '0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd'.toUpperCase().replace('0X', '0x')
        })
      })
    ).toThrow(/Centrifuge vault .* is claimed by two share classes/);
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
