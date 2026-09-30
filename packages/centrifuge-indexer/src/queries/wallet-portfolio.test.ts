import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchDailyTokenSnapshots } from './daily-token-snapshots';
import { fetchWalletActivityPage, fetchWalletCheckpoints } from './wallet-portfolio';

const args = { environment: 'testnet' as const, shareClassKey: 'zsmb', account: '0xAbC' };
const pageInfo = (cursor: string | null) => ({ hasNextPage: cursor !== null, endCursor: cursor });
const checkpoint = (logIndex: number) => ({
  centrifugeId: '1',
  balanceBefore: '0',
  balanceAfter: '100',
  createdAt: '1789948800000',
  createdAtBlock: 100,
  createdAtTxHash: '0xABC',
  logIndex,
  tokenInstance: { blockchain: { id: '11155111' } }
});
function responses(...data: Array<unknown>) {
  const fn = vi.fn();
  data.forEach((item) => fn.mockResolvedValueOnce(new Response(JSON.stringify({ data: item }))));
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

describe('wallet-filtered portfolio readers', () => {
  it('walks checkpoint pages, deduplicates overlapping rows and orders tied timestamps by log index', async () => {
    const fetch = responses(
      { investorPositionCheckpoints: { items: [checkpoint(3), checkpoint(1)], pageInfo: pageInfo('next') } },
      { investorPositionCheckpoints: { items: [checkpoint(3), checkpoint(2)], pageInfo: pageInfo(null) } }
    );
    const result = await fetchWalletCheckpoints(args);
    expect(result.complete).toBe(true);
    expect(result.checkpoints.map((row) => row.logIndex)).toEqual([1, 2, 3]);
    const first = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(first.variables.account).toBe('0xabc');
    expect(first.query).toContain('accountAddress: $account');
    expect(JSON.parse(fetch.mock.calls[1]![1].body).variables.after).toBe('next');
  });
  it('marks repeated or missing cursors as incomplete', async () => {
    responses({ investorPositionCheckpoints: { items: [], pageInfo: { hasNextPage: true, endCursor: null } } });
    expect((await fetchWalletCheckpoints(args)).complete).toBe(false);
    responses(...[1, 2].map(() => ({ investorPositionCheckpoints: { items: [], pageInfo: pageInfo('same') } })));
    expect((await fetchWalletCheckpoints(args)).complete).toBe(false);
  });
  it('keeps malformed or failed history from being confirmed empty', async () => {
    responses({
      investorPositionCheckpoints: { items: [{ ...checkpoint(1), createdAt: '123' }], pageInfo: pageInfo(null) }
    });
    await expect(fetchWalletCheckpoints(args)).rejects.toThrow();
  });
  it('pages transfers server-side without changing the monitor query', async () => {
    const entry = {
      type: 'TRANSFER_IN',
      centrifugeId: '1',
      tokenAmount: '2000000000000000000',
      currencyAmount: null,
      createdAt: '1789948800000',
      createdAtBlock: 1,
      createdAtTxHash: '0xABC',
      blockchain: { id: '11155111' },
      currencyAsset: null,
      fromAccount: '0xdef',
      toAccount: '0xabc',
      fromCentrifugeId: null,
      toCentrifugeId: null,
      transferMessageId: null,
      transferLeg: null
    };
    const fetch = responses({ investorTransactions: { items: [entry], pageInfo: pageInfo('next') } });
    const result = await fetchWalletActivityPage({ ...args, transfersOnly: true, after: 'previous' });
    expect(result.nextCursor).toBe('next');
    expect(result.entries[0]).toMatchObject({ type: 'TRANSFER_IN', tokenAmount: 2n * 10n ** 18n, txHash: '0xabc' });
    const body = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(body.variables).toMatchObject({
      where: { account: '0xabc', type_in: ['TRANSFER_IN', 'TRANSFER_OUT'] },
      after: 'previous'
    });
    expect(body.variables.where).not.toHaveProperty('createdAtTxHash_in');
    expect(body.query).toContain('where: $where');
  });
  it('fails stalled activity pagination so a Load more button cannot repeat a page', async () => {
    responses({ investorTransactions: { items: [], pageInfo: pageInfo('same') } });
    await expect(fetchWalletActivityPage({ ...args, after: 'same' })).rejects.toThrow('pagination');
  });
  it('loads transaction context across page boundaries while retaining the original transfer cursor', async () => {
    const entry = {
      type: 'TRANSFER_IN',
      centrifugeId: '1',
      tokenAmount: '80',
      currencyAmount: null,
      createdAt: '1789948800000',
      createdAtBlock: 1,
      createdAtTxHash: '0xABC',
      blockchain: { id: '11155111' },
      currencyAsset: null,
      fromAccount: null,
      toAccount: '0xabc',
      fromCentrifugeId: '1',
      toCentrifugeId: '1',
      transferMessageId: null,
      transferLeg: null
    };
    const deposit = { ...entry, type: 'SYNC_DEPOSIT', currencyAmount: '100', currencyAsset: { address: '0xUSDC' } };
    const fetch = responses(
      { investorTransactions: { items: [entry], pageInfo: pageInfo('base-next') } },
      { investorTransactions: { items: [entry], pageInfo: pageInfo('context-next') } },
      { investorTransactions: { items: [deposit], pageInfo: pageInfo(null) } }
    );
    const result = await fetchWalletActivityPage({ ...args, transfersOnly: true, includeTransactionContext: true });
    expect(result.nextCursor).toBe('base-next');
    expect(result.entries.map((item) => item.type)).toEqual(['TRANSFER_IN', 'SYNC_DEPOSIT']);
    const context = JSON.parse(fetch.mock.calls[1]![1].body);
    expect(context.variables).toMatchObject({
      where: { account: '0xabc', createdAtTxHash_in: ['0xABC'] },
      after: null
    });
    expect(context.variables.where.type_in).toContain('SYNC_DEPOSIT');
    expect(JSON.parse(fetch.mock.calls[2]![1].body).variables.after).toBe('context-next');
  });
  it('paginates prices and assigns midnight snapshots to the previous UTC day', async () => {
    const fetch = responses(
      {
        tokenSnapshots: {
          items: [
            {
              timestamp: String(Date.parse('2026-09-23T00:00:00Z')),
              tokenPrice: '2000000000000000000',
              totalIssuance: null,
              yield30dComp365: null
            }
          ],
          pageInfo: pageInfo('older')
        }
      },
      {
        tokenSnapshots: {
          items: [
            {
              timestamp: String(Date.parse('2026-09-22T00:00:00Z')),
              tokenPrice: '1000000000000000000',
              totalIssuance: null,
              yield30dComp365: null
            }
          ],
          pageInfo: pageInfo(null)
        }
      }
    );
    const result = await fetchDailyTokenSnapshots({ ...args, paginate: true });
    expect(result.truncated).toBe(false);
    expect(result.snapshots.map((row) => row.dayStartSeconds)).toEqual([
      Date.parse('2026-09-21') / 1000,
      Date.parse('2026-09-22') / 1000
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
