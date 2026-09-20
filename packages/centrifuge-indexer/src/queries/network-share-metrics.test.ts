import { afterEach, describe, expect, it, vi } from 'vitest';

import { getShareClassIdentity, listShareClassChainIdentities } from '../share-classes';
import { fetchNetworkShareMetrics } from './network-share-metrics';

const now = Date.parse('2026-09-20T12:00:00Z');
const identity = getShareClassIdentity({ environment: 'testnet', key: 'zsmb' });
function fixture() {
  return {
    data: {
      token: {
        id: identity.scId,
        poolId: identity.poolId,
        isActive: true,
        decimals: 18,
        totalIssuance: '3000000000000000000',
        tokenPrice: '1137950000000000000',
        tokenPriceComputedAt: String(now - 60_000),
        pool: { currency: '840', decimals: 18 }
      },
      tokenInstances: {
        totalCount: 2,
        pageInfo: { hasNextPage: false },
        items: [
          {
            centrifugeId: '1',
            tokenId: identity.scId,
            address: listShareClassChainIdentities({ chain: 'sepolia', key: 'zsmb' })[0].shareTokenAddress,
            decimals: 18,
            totalIssuance: '1000000000000000000',
            tokenPrice: '1100000000000000000',
            computedAt: String(now - 120_000),
            blockchain: { chainId: 11155111 }
          },
          {
            centrifugeId: '2',
            tokenId: identity.scId,
            address: listShareClassChainIdentities({ chain: 'base-sepolia', key: 'zsmb' })[0].shareTokenAddress,
            decimals: 18,
            totalIssuance: '2000000000000000000',
            tokenPrice: '1200000000000000000',
            computedAt: String(now - 90_000),
            blockchain: { chainId: 84532 }
          }
        ]
      },
      _meta: {
        status: {
          sepolia: { id: 11155111, block: { timestamp: now / 1000 - 10 } },
          base: { id: 84532, block: { timestamp: now / 1000 - 20 } }
        }
      }
    }
  };
}
function read(payload = fixture()) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))));
  return fetchNetworkShareMetrics({ environment: 'testnet', shareClassKey: 'zsmb', now });
}
afterEach(() => vi.unstubAllGlobals());

describe('network share metrics', () => {
  it('sums network-specific products while taking token price from the share class', async () => {
    const result = await read();
    expect(result.navD36).toBe(35n * 10n ** 35n);
    expect(result.sharePriceD18).toBe(1137950000000000000n);
    expect(result.navPriceComputedAt.getTime()).toBe(now - 120_000);
    expect(result.indexedAt.getTime()).toBe(now - 20_000);
  });
  it('retains sub-D18 NAV precision until formatting', async () => {
    const payload = fixture();
    payload.data.tokenInstances.items.forEach((row) => {
      row.totalIssuance = '1';
      row.tokenPrice = '1';
    });
    payload.data.token.totalIssuance = '2';
    expect((await read(payload)).navD36).toBe(2n);
  });
  it.each([
    [
      'a truncated page',
      (p: ReturnType<typeof fixture>) => {
        p.data.tokenInstances.pageInfo.hasNextPage = true;
      }
    ],
    [
      'a missing result',
      (p: ReturnType<typeof fixture>) => {
        p.data.tokenInstances.items.pop();
      }
    ],
    [
      'a supply mismatch',
      (p: ReturnType<typeof fixture>) => {
        p.data.token.totalIssuance = '1';
      }
    ],
    [
      'duplicate networks',
      (p: ReturnType<typeof fixture>) => {
        p.data.tokenInstances.items[1] = p.data.tokenInstances.items[0]!;
      }
    ],
    [
      'a missing zero-balance deployment',
      (p: ReturnType<typeof fixture>) => {
        p.data.tokenInstances.items.pop();
        p.data.tokenInstances.totalCount = 1;
        p.data.token.totalIssuance = '1000000000000000000';
      }
    ],
    [
      'a stale indexer',
      (p: ReturnType<typeof fixture>) => {
        p.data._meta.status.base.block.timestamp -= 301;
      }
    ],
    [
      'a future publication',
      (p: ReturnType<typeof fixture>) => {
        p.data.token.tokenPriceComputedAt = String(now + 60_000);
      }
    ],
    [
      'an unpriced network',
      (p: ReturnType<typeof fixture>) => {
        p.data.tokenInstances.items[0]!.tokenPrice = '0';
      }
    ],
    [
      'a wrong token',
      (p: ReturnType<typeof fixture>) => {
        p.data.tokenInstances.items[0]!.tokenId = '0xdead';
      }
    ]
  ])('rejects %s', async (_label, mutate) => {
    const payload = fixture();
    mutate(payload);
    await expect(read(payload)).rejects.toMatchObject({ kind: 'validation' });
  });
});
