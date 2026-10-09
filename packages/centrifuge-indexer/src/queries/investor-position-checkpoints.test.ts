import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchInvestorPositionCheckpoints } from '../index';
import { fakeIndexerResponse } from '../test-helpers';

const T0 = 1_786_000_000_000;

function checkpoint(overrides: Record<string, unknown> = {}) {
  return {
    balanceAfter: '1000000000000000000',
    createdAt: String(T0),
    createdAtBlock: 10,
    createdAtTxHash: '0xAAA',
    logIndex: 3,
    tokenInstance: { blockchain: { id: '1' } },
    ...overrides
  };
}

function page(items: Array<unknown>, pageInfo = { hasNextPage: false, endCursor: null as string | null }) {
  return { data: { investorPositionCheckpoints: { items, pageInfo } } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchInvestorPositionCheckpoints', () => {
  it('walks every page newest first, re-orders by time then block then log index, and drops chainless rows', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            page(
              // Newest first, as the indexer answers.
              [
                checkpoint({
                  createdAt: String(T0 + 1000),
                  balanceAfter: '0',
                  tokenInstance: { blockchain: { id: '8453' } }
                }),
                checkpoint({ logIndex: 7, createdAtBlock: 10 }),
                checkpoint({ tokenInstance: { blockchain: null } })
              ],
              { hasNextPage: true, endCursor: 'cursor-1' }
            )
          )
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(page([checkpoint({ logIndex: 2, createdAtBlock: 10, createdAtTxHash: '0xBBB' })])))
      );
    vi.stubGlobal('fetch', fetchMock);

    const { checkpoints, complete } = await fetchInvestorPositionCheckpoints({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      account: '0xB8dA328a4edB64AF841C6bb72B55988e9AbEB172'
    });

    expect(complete).toBe(true);
    expect(checkpoints.map((row) => [row.chainId, row.logIndex, row.txHash])).toEqual([
      [1, 2, '0xbbb'],
      [1, 7, '0xaaa'],
      [8453, 3, '0xaaa']
    ]);
    expect(checkpoints[2]?.balanceAfter).toBe(0n);

    const secondCall = JSON.parse(fetchMock.mock.calls[1]![1].body as string) as { variables: { after: string } };
    expect(secondCall.variables.after).toBe('cursor-1');
  });

  it('reports an incomplete walk when the cursor stops advancing', async () => {
    fakeIndexerResponse(page([checkpoint()], { hasNextPage: true, endCursor: null }));

    const { checkpoints, complete } = await fetchInvestorPositionCheckpoints({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      account: '0xabc'
    });

    expect(complete).toBe(false);
    expect(checkpoints).toHaveLength(1);
  });
});
