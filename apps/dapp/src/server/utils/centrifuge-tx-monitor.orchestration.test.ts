import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type InvestorTransactionEvent,
  fetchIndexerChainStatuses,
  fetchInvestorTransactionEventsSince,
  getShareClassIdentity
} from '@zivoe/centrifuge-indexer';
import { monitorCursor, transactionNotified, walletConnection } from '@zivoe/database/schema';

import { sendBatchedTelegramMessages } from '@/server/utils/send-telegram';

import { zivoeVaultChains } from '@/zivoe-vaults';

import { CENTRIFUGE_TX_MONITOR_KEY, runCentrifugeTransactionMonitor } from './centrifuge-tx-monitor';
import { buildReceiptJobKey } from './centrifuge-tx-receipt-job';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
// Registry modules pull component trees; the monitor only needs their data shape.
vi.mock('@/zivoe-vaults', () => ({
  ZIVOE_VAULTS: [{ slug: 'zsmb', shareClass: { key: 'zsmb' } }],
  zivoeVaultChains: vi.fn(() => ['sepolia'])
}));
// A hoisted handle instead of the client's method keeps the mock unbound-safe.
const { batchJSONMock } = vi.hoisted(() => ({ batchJSONMock: vi.fn() }));
vi.mock('@/server/clients/qstash', () => ({ qstash: { batchJSON: batchJSONMock } }));
vi.mock('@zivoe/centrifuge-indexer', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchIndexerChainStatuses: vi.fn(),
  fetchInvestorTransactionEventsSince: vi.fn(),
  getShareClassIdentity: vi.fn()
}));
vi.mock('@/server/utils/send-telegram', () => ({ sendBatchedTelegramMessages: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  logger: { info: vi.fn() }
}));

const staleCaptures = () =>
  vi
    .mocked(Sentry.captureException)
    .mock.calls.filter((call) => call[0] instanceof Error && call[0].message.includes('Centrifuge indexer stale'));

/**
 * In-memory stand-in for the drizzle surface the pass uses. Where-conditions
 * are resolved by collecting the string params inside drizzle's SQL tree —
 * dispatch is by table identity, so the fake stays oblivious to operators.
 */
const state = {
  lockAvailable: true,
  cursors: new Map<string, number>(),
  notified: new Set<string>(),
  emails: [] as Array<{ address: string; userId: string; email: string }>
};

function stringParams(node: unknown, out: Array<string> = []): Array<string> {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const child of node) stringParams(child, out);
    return out;
  }
  const rec = node as Record<string, unknown>;
  // Only Params carry `encoder` — StringChunks also have `value`, but those
  // are SQL text, not bound values.
  if ('encoder' in rec) {
    if (typeof rec.value === 'string') out.push(rec.value);
    else if (Array.isArray(rec.value)) for (const v of rec.value) if (typeof v === 'string') out.push(v);
  }
  if (Array.isArray(rec.queryChunks)) for (const chunk of rec.queryChunks) stringParams(chunk, out);
  return out;
}

function thenable(rowsFn: () => Array<Record<string, unknown>> | void) {
  return {
    then: (resolve: (rows: unknown) => void, reject: (err: unknown) => void) =>
      Promise.resolve()
        .then(rowsFn)
        .then((rows) => resolve(rows ?? []), reject),
    limit: () => thenable(rowsFn),
    orderBy: () => thenable(rowsFn)
  };
}

function resolveSelect(table: unknown, cond: unknown): Array<Record<string, unknown>> {
  const params = stringParams(cond);
  if (table === monitorCursor) {
    const value = state.cursors.get(params[0] ?? '');
    return value === undefined ? [] : [{ lastEventAt: value }];
  }
  if (table === transactionNotified)
    return params.filter((id) => state.notified.has(id)).map((eventId) => ({ eventId }));
  if (table === walletConnection) return state.emails.filter((row) => params.includes(row.address));
  throw new Error('unexpected table in select');
}

const txFake = {
  execute: () => Promise.resolve([{ locked: state.lockAvailable }]),
  select: () => ({
    from: (table: unknown) => ({
      where: (cond: unknown) => thenable(() => resolveSelect(table, cond)),
      innerJoin: () => ({ where: (cond: unknown) => thenable(() => resolveSelect(walletConnection, cond)) })
    })
  }),
  insert: (table: unknown) => ({
    values: (values: Record<string, unknown> | Array<Record<string, unknown>>) => ({
      onConflictDoNothing: () =>
        thenable(() => {
          for (const row of Array.isArray(values) ? values : [values]) {
            if (table === transactionNotified) state.notified.add(row.eventId as string);
          }
        }),
      onConflictDoUpdate: () =>
        thenable(() => {
          if (table !== monitorCursor) throw new Error('unexpected upsert table');
          const row = values as { monitor: string; lastEventAt: number };
          const existing = state.cursors.get(row.monitor);
          // Mirrors the monotonic setWhere guard.
          if (existing === undefined || row.lastEventAt > existing) state.cursors.set(row.monitor, row.lastEventAt);
        })
    })
  })
};

vi.mock('@/server/clients/db', () => ({
  db: { transaction: (cb: (tx: unknown) => Promise<unknown>) => cb(txFake) }
}));

const NOW = 1_786_000_000_000;
const SEPOLIA_CHAIN_ID = 11155111;
const BASE_SEPOLIA_CHAIN_ID = 84532;

const identity = { key: 'zsmb', symbol: 'zSMB', decimals: 18, poolId: '281474976720680', scId: '0xsc' } as const;

function mkEvent(offsetMs: number, overrides: Partial<InvestorTransactionEvent> = {}): InvestorTransactionEvent {
  return {
    type: 'SYNC_DEPOSIT',
    centrifugeId: '1',
    chainId: SEPOLIA_CHAIN_ID,
    account: '0xabc',
    tokenAmount: 1000000000000000000n,
    currencyAmount: 1000000n,
    tokenPrice: 1000000000000000000n,
    createdAtMs: NOW - 10 * 60_000 + offsetMs,
    txHash: `0xtx${offsetMs}`,
    chainName: 'ethereum',
    explorerUrl: null,
    ...overrides
  };
}

function freshStatuses(lastIndexedAtMs = NOW - 60_000) {
  return new Map([[SEPOLIA_CHAIN_ID, { blockNumber: 1, lastIndexedAtMs }]]);
}

/** Serves the feed the way the real query does: rows strictly newer than `sinceMs`, oldest first. */
function serveFeed(feed: Array<InvestorTransactionEvent>, truncated = false) {
  vi.mocked(fetchInvestorTransactionEventsSince).mockImplementation(async ({ sinceMs }) => ({
    events: feed.filter((event) => event.createdAtMs > sinceMs).sort((a, b) => a.createdAtMs - b.createdAtMs),
    truncated,
    malformed: []
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.lockAvailable = true;
  state.cursors.clear();
  state.notified.clear();
  state.emails = [];
  vi.mocked(zivoeVaultChains).mockReturnValue(['sepolia']);
  vi.mocked(getShareClassIdentity).mockReturnValue(identity);
  vi.mocked(fetchIndexerChainStatuses).mockResolvedValue(freshStatuses());
  vi.mocked(fetchInvestorTransactionEventsSince).mockResolvedValue({ events: [], truncated: false, malformed: [] });
  vi.mocked(sendBatchedTelegramMessages).mockResolvedValue(undefined);
  batchJSONMock.mockResolvedValue([]);
});

describe('runCentrifugeTransactionMonitor', () => {
  it('bootstrap seeds the cursor at the slowest indexed head and alerts on nothing', async () => {
    const result = await runCentrifugeTransactionMonitor();

    expect(result.bootstrapped).toBe(true);
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(NOW - 60_000);
    expect(sendBatchedTelegramMessages).not.toHaveBeenCalled();
    expect(fetchInvestorTransactionEventsSince).not.toHaveBeenCalled();
  });

  it('alerts fresh events once, dedupes ledger replays, and clamps the advance to the indexed head', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    const replayed = mkEvent(0);
    const fresh = mkEvent(1000);
    state.notified.add(`0xsc:1:${replayed.txHash}:SYNC_DEPOSIT:0xabc`);
    vi.mocked(fetchInvestorTransactionEventsSince).mockResolvedValue({
      events: [replayed, fresh],
      truncated: false,
      malformed: []
    });

    const result = await runCentrifugeTransactionMonitor();

    expect(result).toMatchObject({ eventsSeen: 2, notified: 1, skippedDuplicates: 1 });
    const items = vi.mocked(sendBatchedTelegramMessages).mock.calls[0]?.[0]?.items;
    expect(items).toHaveLength(1);
    expect(items?.[0]).toContain(fresh.txHash);
    expect(state.notified.has(`0xsc:1:${fresh.txHash}:SYNC_DEPOSIT:0xabc`)).toBe(true);
    // Advance goes to the slowest chain's head (NOW - 60s), not to the newest event.
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(NOW - 60_000);
  });

  it('a failed send records nothing and never advances the cursor', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    vi.mocked(fetchInvestorTransactionEventsSince).mockResolvedValue({
      events: [mkEvent(0)],
      truncated: false,
      malformed: []
    });
    vi.mocked(sendBatchedTelegramMessages).mockRejectedValue(new Error('telegram down'));

    await expect(runCentrifugeTransactionMonitor()).rejects.toThrow('telegram down');

    expect(state.notified.size).toBe(0);
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(NOW - 20 * 60_000);
  });

  it('a held lock skips the pass without reading or sending', async () => {
    state.lockAvailable = false;

    const result = await runCentrifugeTransactionMonitor();

    expect(result.skipped).toBe(true);
    expect(fetchInvestorTransactionEventsSince).not.toHaveBeenCalled();
    expect(sendBatchedTelegramMessages).not.toHaveBeenCalled();
  });

  it('declines to bootstrap while the head is stale — a lagging indexer at launch must not seed the past', async () => {
    vi.mocked(fetchIndexerChainStatuses).mockResolvedValue(freshStatuses(NOW - 3 * 24 * 60 * 60_000));

    const result = await runCentrifugeTransactionMonitor();

    expect(result.bootstrapped).toBe(false);
    expect(result.indexerStale).toBe(true);
    expect(state.cursors.has(CENTRIFUGE_TX_MONITOR_KEY)).toBe(false);
    expect(fetchInvestorTransactionEventsSince).not.toHaveBeenCalled();
  });

  it('a stale indexer raises a Sentry issue — even under a held lock — and freezes the cursor', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    // Chain missing from status: stale AND no head to clamp to.
    vi.mocked(fetchIndexerChainStatuses).mockResolvedValue(new Map());
    vi.mocked(fetchInvestorTransactionEventsSince).mockResolvedValue({
      events: [mkEvent(0)],
      truncated: false,
      malformed: []
    });

    const first = await runCentrifugeTransactionMonitor();

    expect(first.indexerStale).toBe(true);
    expect(staleCaptures()).toHaveLength(1);
    // Warnings never reach the transactions channel — Sentry is the alerting hub.
    const sentItems = vi.mocked(sendBatchedTelegramMessages).mock.calls.flatMap((call) => call[0]?.items ?? []);
    expect(sentItems.some((item) => item.includes('stale'))).toBe(false);
    // Events still alert, but the watermark holds — the head is unknown.
    expect(first.notified).toBe(1);
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(NOW - 20 * 60_000);

    // The report happens before the transaction, so a held lock cannot swallow it.
    state.lockAvailable = false;
    const second = await runCentrifugeTransactionMonitor();
    expect(second.skipped).toBe(true);
    expect(second.indexerStale).toBe(true);
    expect(staleCaptures()).toHaveLength(2);
  });

  it('a truncated walk alerts what it fetched and recovers the cursor only up to its oldest row', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    serveFeed([mkEvent(0), mkEvent(1000)], true);

    const result = await runCentrifugeTransactionMonitor();

    expect(result.notified).toBe(2);
    // Rows older than the walk are unreachable either way; holding would only
    // re-fetch the same cap forever, so the watermark moves to the walk floor.
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(mkEvent(0).createdAtMs);
  });

  it('drains a dense backlog across passes: dedupe before the cap, advance past what was processed', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    // 150 events inside one OVERLAP_MS span — capping before the dedupe would
    // re-select the same notified 100 every pass and never advance again.
    const backlog = Array.from({ length: 150 }, (_, i) => mkEvent(i * 1000, { txHash: `0xbulk${i}` }));
    serveFeed(backlog);

    const first = await runCentrifugeTransactionMonitor();

    expect(first).toMatchObject({ eventsSeen: 150, notified: 100, skippedDuplicates: 0 });
    expect(vi.mocked(sendBatchedTelegramMessages).mock.calls[0]?.[0]?.items).toHaveLength(100);
    // Cursor stops at the 100th event, so the remaining 50 stay in the window.
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(backlog[99]?.createdAtMs);

    const second = await runCentrifugeTransactionMonitor();

    expect(second).toMatchObject({ eventsSeen: 150, notified: 50, skippedDuplicates: 100 });
    expect(state.notified.size).toBe(150);
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(NOW - 60_000);

    const third = await runCentrifugeTransactionMonitor();
    expect(third).toMatchObject({ notified: 0, skippedDuplicates: 150 });
  });

  it('a window saturated with notified replays still alerts the newer events behind them', async () => {
    const cursor = NOW - 60_000;
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, cursor);
    // 120 replays inside the overlap window, all already in the ledger.
    const replays = Array.from({ length: 120 }, (_, i) =>
      mkEvent(0, { createdAtMs: cursor - 14 * 60_000 + i * 1000, txHash: `0xold${i}` })
    );
    for (const event of replays) state.notified.add(`0xsc:1:${event.txHash}:SYNC_DEPOSIT:0xabc`);
    const newer = [mkEvent(0, { createdAtMs: cursor + 1000, txHash: '0xnew1' })];
    serveFeed([...replays, ...newer]);

    const result = await runCentrifugeTransactionMonitor();

    expect(result).toMatchObject({ eventsSeen: 121, notified: 1, skippedDuplicates: 120 });
    expect(state.notified.has('0xsc:1:0xnew1:SYNC_DEPOSIT:0xabc')).toBe(true);
  });

  it('drops events from a chain this deployment does not serve — they would sit outside the clamp — and keeps chainless rows', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    serveFeed([
      mkEvent(0, { chainId: BASE_SEPOLIA_CHAIN_ID, txHash: '0xforeign' }),
      mkEvent(1000, { chainId: null, txHash: '0xchainless' }),
      mkEvent(2000)
    ]);

    const result = await runCentrifugeTransactionMonitor();

    expect(result).toMatchObject({ eventsSeen: 2, notified: 2 });
    expect(state.notified.has('0xsc:1:0xforeign:SYNC_DEPOSIT:0xabc')).toBe(false);
    expect(vi.mocked(Sentry.captureException).mock.calls[0]?.[1]).toMatchObject({
      extra: { chainIds: [BASE_SEPOLIA_CHAIN_ID] }
    });
  });

  it('clamps the advance to the slowest of several active chains and reports only the stale one', async () => {
    vi.mocked(zivoeVaultChains).mockReturnValue(['sepolia', 'base-sepolia']);
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 60 * 60_000);
    vi.mocked(fetchIndexerChainStatuses).mockResolvedValue(
      new Map([
        [SEPOLIA_CHAIN_ID, { blockNumber: 1, lastIndexedAtMs: NOW - 60_000 }],
        [BASE_SEPOLIA_CHAIN_ID, { blockNumber: 1, lastIndexedAtMs: NOW - 45 * 60_000 }]
      ])
    );
    serveFeed([mkEvent(0)]);

    const result = await runCentrifugeTransactionMonitor();

    expect(result).toMatchObject({ indexerStale: true, notified: 1 });
    expect(vi.mocked(Sentry.captureException).mock.calls[0]?.[1]).toMatchObject({
      extra: { staleChains: [{ chain: 'base-sepolia', minutesOld: 45, blockNumber: 1 }] }
    });
    // The laggard bounds the watermark — its back-filled rows stay inside the window.
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(NOW - 45 * 60_000);
  });

  it('one active chain missing from the status map holds the cursor even though the other is fresh', async () => {
    vi.mocked(zivoeVaultChains).mockReturnValue(['sepolia', 'base-sepolia']);
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    serveFeed([mkEvent(0)]);

    const result = await runCentrifugeTransactionMonitor();

    expect(result).toMatchObject({ indexerStale: true, notified: 1 });
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(NOW - 20 * 60_000);
  });

  it('enqueues one Receipt Mailer job per (event, linked user); unlinked wallets enqueue nothing', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    state.emails = [
      { address: '0xabc', userId: 'user-1', email: 'a@x.y' },
      { address: '0xabc', userId: 'user-2', email: 'b@x.y' }
    ];
    serveFeed([mkEvent(0), mkEvent(1000, { account: '0xunlinked', txHash: '0xother' })]);

    const result = await runCentrifugeTransactionMonitor();

    expect(result).toMatchObject({ notified: 2, emailJobsEnqueued: 2 });
    const batch = batchJSONMock.mock.calls[0]?.[0];
    expect(batch).toHaveLength(2);
    const eventId = '0xsc:1:0xtx0:SYNC_DEPOSIT:0xabc';
    expect(batch?.[0]).toMatchObject({
      url: expect.stringContaining('/api/email/transaction-receipt'),
      label: 'email.transaction-receipt',
      retries: 3,
      deduplicationId: `receipt-${buildReceiptJobKey({ eventId, userId: 'user-1' })}`,
      body: {
        eventId,
        userId: 'user-1',
        zivoeVaultSlug: 'zsmb',
        shareClassKey: 'zsmb',
        // Amounts travel as strings — the payload must survive JSON.
        event: expect.objectContaining({ type: 'SYNC_DEPOSIT', tokenAmount: '1000000000000000000' })
      }
    });
    expect(batch?.[1]).toMatchObject({ body: expect.objectContaining({ userId: 'user-2' }) });
  });

  it('a pass with no linked users publishes no batch at all', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    serveFeed([mkEvent(0)]);

    const result = await runCentrifugeTransactionMonitor();

    expect(result).toMatchObject({ notified: 1, emailJobsEnqueued: 0 });
    expect(batchJSONMock).not.toHaveBeenCalled();
  });

  it('a failed publish records nothing and holds the cursor — a Telegram repeat is the price, a lost email never is', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    state.emails = [{ address: '0xabc', userId: 'user-1', email: 'a@x.y' }];
    serveFeed([mkEvent(0)]);
    batchJSONMock.mockRejectedValue(new Error('qstash down'));

    await expect(runCentrifugeTransactionMonitor()).rejects.toThrow('qstash down');

    expect(sendBatchedTelegramMessages).toHaveBeenCalledTimes(1);
    expect(state.notified.size).toBe(0);
    expect(state.cursors.get(CENTRIFUGE_TX_MONITOR_KEY)).toBe(NOW - 20 * 60_000);
  });

  it('a failed Telegram send publishes no email jobs — the channels fail forward together', async () => {
    state.cursors.set(CENTRIFUGE_TX_MONITOR_KEY, NOW - 20 * 60_000);
    state.emails = [{ address: '0xabc', userId: 'user-1', email: 'a@x.y' }];
    serveFeed([mkEvent(0)]);
    vi.mocked(sendBatchedTelegramMessages).mockRejectedValue(new Error('telegram down'));

    await expect(runCentrifugeTransactionMonitor()).rejects.toThrow('telegram down');

    expect(batchJSONMock).not.toHaveBeenCalled();
  });
});
