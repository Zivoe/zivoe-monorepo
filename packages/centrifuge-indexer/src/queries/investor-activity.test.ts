import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchInvestorActivityPage, fetchManualShareIssuances } from '../index';
import { fakeIndexerResponse } from '../test-helpers';

const T0 = 1_786_000_000_000;
const at = (offsetMs: number) => String(T0 + offsetMs);

function row(overrides: Record<string, unknown> = {}) {
  return {
    type: 'SYNC_DEPOSIT',
    tokenAmount: '87900000000000000',
    currencyAmount: '100000',
    createdAt: at(3000),
    createdAtBlock: 100,
    createdAtTxHash: '0xDEPOSIT',
    blockchain: { id: '1' },
    currencyAsset: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    ...overrides
  };
}

function page(items: Array<unknown>, pageInfo = { hasNextPage: false, endCursor: null as string | null }) {
  return { data: { investorTransactions: { items, pageInfo } } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchInvestorActivityPage', () => {
  it('completes the boundary transactions from a second request and dedupes by type and hash', async () => {
    const fetchMock = vi
      .fn()
      // The page cuts a deposit off from its mint leg.
      .mockResolvedValueOnce(new Response(JSON.stringify(page([row()], { hasNextPage: true, endCursor: 'cursor-1' }))))
      // The context request returns both legs of that transaction.
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            page([
              row(),
              row({ type: 'TRANSFER_IN', currencyAmount: '0', currencyAsset: null, createdAtTxHash: '0xdeposit' })
            ])
          )
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const { rows, nextCursor } = await fetchInvestorActivityPage({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      account: '0xB8dA328a4edB64AF841C6bb72B55988e9AbEB172'
    });

    expect(nextCursor).toBe('cursor-1');
    expect(rows.map((item) => item.type)).toEqual(['SYNC_DEPOSIT', 'TRANSFER_IN']);
    expect(rows[0]).toEqual({
      type: 'SYNC_DEPOSIT',
      chainId: 1,
      txHash: '0xdeposit',
      timestampMs: T0 + 3000,
      block: 100,
      tokenAmount: 87900000000000000n,
      currencyAmount: 100000n,
      asset: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6 }
    });
    expect(rows[1]?.asset).toBeNull();

    const contextBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string) as {
      variables: { where: { createdAtTxHash_in: Array<string>; account: string } };
    };
    expect(contextBody.variables.where.createdAtTxHash_in).toEqual(['0xDEPOSIT']);
    expect(contextBody.variables.where.account).toBe('0xb8da328a4edb64af841c6bb72b55988e9abeb172');
  });

  it('ends the walk on the last page without a context request for an empty page', async () => {
    const fetchMock = fakeIndexerResponse(page([]));

    const { rows, nextCursor } = await fetchInvestorActivityPage({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      account: '0xabc'
    });

    expect(rows).toEqual([]);
    expect(nextCursor).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refuses a page whose cursor did not advance', async () => {
    fakeIndexerResponse(page([row()], { hasNextPage: true, endCursor: 'same' }));

    await expect(
      fetchInvestorActivityPage({ environment: 'testnet', shareClassKey: 'zsmb', account: '0xabc', after: 'same' })
    ).rejects.toThrow('did not advance');
  });
});

describe('fetchManualShareIssuances', () => {
  it('maps the manager mints with their chain and hash', async () => {
    fakeIndexerResponse({
      data: {
        tokenIssuances: {
          items: [{ shares: '1000043790000000000000000', createdAtTxHash: '0xMINT', blockchain: { id: '1' } }],
          pageInfo: { hasNextPage: false }
        }
      }
    });

    await expect(
      fetchManualShareIssuances({ environment: 'testnet', shareClassKey: 'zsmb', account: '0xabc' })
    ).resolves.toEqual([{ chainId: 1, txHash: '0xmint', shares: 1000043790000000000000000n }]);
  });
});
