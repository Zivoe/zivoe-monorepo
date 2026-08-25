import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchInvestorTransactionEventsSince } from '../index';
import { fakeIndexerResponse } from '../test-helpers';

// 13-digit ms base — the boundary rejects anything shorter (seconds-scale).
const T0 = 1_786_000_000_000;
const at = (offsetMs: number) => String(T0 + offsetMs);

function investorTxItem(overrides: Record<string, unknown> = {}) {
  return {
    type: 'SYNC_DEPOSIT',
    centrifugeId: '1',
    account: '0xB8dA328a4edB64AF841C6bb72B55988e9AbEB172',
    tokenAmount: '4405778757590310318',
    currencyAmount: '5000000',
    tokenPrice: '1134873146180107400',
    createdAt: at(3000),
    createdAtTxHash: '0xCCdaB4D1',
    blockchain: { id: '1', network: 'ethereum', explorer: 'https://etherscan.io' },
    ...overrides
  };
}

function investorTxPage(items: Array<unknown>, pageInfo: { hasNextPage: boolean; endCursor: string | null }) {
  return { data: { investorTransactions: { items, pageInfo } } };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchInvestorTransactionEventsSince', () => {
  it('returns only rows newer than the cursor, oldest first, with mapped units', async () => {
    fakeIndexerResponse(
      investorTxPage(
        [
          investorTxItem({ createdAt: at(3000), type: 'REDEEM_REQUEST_UPDATED', currencyAmount: '0', tokenPrice: '0' }),
          investorTxItem({ createdAt: at(2000) }),
          investorTxItem({ createdAt: at(1000), createdAtTxHash: '0xold' })
        ],
        // hasNextPage lies "more" on purpose: crossing the window must stop the walk.
        { hasNextPage: true, endCursor: 'cursor-1' }
      )
    );

    const { events, truncated } = await fetchInvestorTransactionEventsSince({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      sinceMs: T0 + 1500
    });

    expect(truncated).toBe(false);
    expect(events.map((event) => event.createdAtMs)).toEqual([T0 + 2000, T0 + 3000]);
    expect(events[0]).toEqual({
      type: 'SYNC_DEPOSIT',
      centrifugeId: '1',
      chainId: 1,
      account: '0xb8da328a4edb64af841c6bb72b55988e9abeb172',
      tokenAmount: 4405778757590310318n,
      currencyAmount: 5000000n,
      tokenPrice: 1134873146180107400n,
      createdAtMs: T0 + 2000,
      txHash: '0xccdab4d1',
      chainName: 'ethereum',
      explorerUrl: 'https://etherscan.io'
    });
  });

  it('walks the next page only while the window is uncrossed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            investorTxPage([investorTxItem({ createdAt: at(4000) })], { hasNextPage: true, endCursor: 'cursor-1' })
          )
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            investorTxPage([investorTxItem({ createdAt: at(3000) }), investorTxItem({ createdAt: at(100) })], {
              hasNextPage: false,
              endCursor: null
            })
          )
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const { events } = await fetchInvestorTransactionEventsSince({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      sinceMs: T0 + 1500
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string);
    expect(secondBody.variables.after).toBe('cursor-1');
    expect(events.map((event) => event.createdAtMs)).toEqual([T0 + 3000, T0 + 4000]);
  });

  it('flags truncation when the page cap is hit with the window still open', async () => {
    // Every page full of newer rows and promising more: the walk must stop at
    // its bound and say so, rather than pretending the window was completed.
    const fetchMock = fakeIndexerResponse(
      investorTxPage([investorTxItem({ createdAt: at(5000) })], { hasNextPage: true, endCursor: 'again' })
    );

    const { truncated } = await fetchInvestorTransactionEventsSince({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      sinceMs: T0
    });

    expect(truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('flags truncation when more pages are promised but no cursor is given to reach them', async () => {
    const fetchMock = fakeIndexerResponse(
      investorTxPage([investorTxItem({ createdAt: at(5000) })], { hasNextPage: true, endCursor: null })
    );

    const { truncated } = await fetchInvestorTransactionEventsSince({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      sinceMs: T0
    });

    expect(truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts the redemption-execution rows — one claimable per partial fill, then the claim', async () => {
    fakeIndexerResponse(
      investorTxPage(
        [
          investorTxItem({ createdAt: at(2000), type: 'REDEEM_CLAIMED', tokenAmount: '2000000000000000000' }),
          investorTxItem({ createdAt: at(1000), type: 'REDEEM_CLAIMABLE', tokenAmount: '2000000000000000000' })
        ],
        { hasNextPage: false, endCursor: null }
      )
    );

    const { events } = await fetchInvestorTransactionEventsSince({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      sinceMs: T0
    });

    expect(events.map((event) => event.type)).toEqual(['REDEEM_CLAIMABLE', 'REDEEM_CLAIMED']);
  });

  it('rejects rows outside the alert surface loudly — the server filter guarantees them absent', async () => {
    fakeIndexerResponse(
      investorTxPage([investorTxItem({ type: 'TRANSFER_IN' })], { hasNextPage: false, endCursor: null })
    );

    await expect(
      fetchInvestorTransactionEventsSince({ environment: 'testnet', shareClassKey: 'zsmb', sinceMs: T0 })
    ).rejects.toThrow(/unexpected response shape/);
  });

  it('rejects a seconds-scale createdAt — a silent ms→s flip would hide every event forever', async () => {
    fakeIndexerResponse(
      investorTxPage([investorTxItem({ createdAt: '1786000000' })], { hasNextPage: false, endCursor: null })
    );

    await expect(
      fetchInvestorTransactionEventsSince({ environment: 'testnet', shareClassKey: 'zsmb', sinceMs: 0 })
    ).rejects.toThrow(/unexpected response shape/);
  });

  it('carries no chain id when the blockchain relation is unavailable', async () => {
    fakeIndexerResponse(
      investorTxPage([investorTxItem({ blockchain: null })], { hasNextPage: false, endCursor: null })
    );

    const { events } = await fetchInvestorTransactionEventsSince({
      environment: 'testnet',
      shareClassKey: 'zsmb',
      sinceMs: T0
    });

    expect(events[0]).toMatchObject({ chainId: null, chainName: null, explorerUrl: null });
  });

  it.each([
    { label: 'negative', tokenAmount: '-2000000000000000000' },
    { label: 'zero', tokenAmount: '0' },
    { label: 'missing', tokenAmount: null }
  ])('rejects a $label redemption request amount as upstream drift', async ({ tokenAmount }) => {
    fakeIndexerResponse(
      investorTxPage([investorTxItem({ type: 'REDEEM_REQUEST_UPDATED', tokenAmount })], {
        hasNextPage: false,
        endCursor: null
      })
    );

    await expect(
      fetchInvestorTransactionEventsSince({ environment: 'testnet', shareClassKey: 'zsmb', sinceMs: T0 })
    ).rejects.toThrow(/unexpected response shape/);
  });
});
