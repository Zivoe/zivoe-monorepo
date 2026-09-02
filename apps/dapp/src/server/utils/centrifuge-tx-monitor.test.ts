import { describe, expect, it, vi } from 'vitest';

import { INVESTOR_TRANSACTION_EVENT_TYPES } from '@zivoe/centrifuge-indexer';
import { investorTransactionTypeValues } from '@zivoe/database/schema';

import { buildEventId } from './centrifuge-tx-monitor';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
// Registry modules pull component trees; the monitor only needs their data shape.
vi.mock('@/zivoe-vaults', () => ({ ZIVOE_VAULTS: [], zivoeVaultChains: () => [] }));
// The real client warns at import time about the (skipped) QSTASH_TOKEN.
vi.mock('@/server/clients/qstash', () => ({ qstash: { batchJSON: vi.fn() } }));

// Drift here fails the ledger insert AFTER the Telegram send, which would
// roll back, retry, and re-send the same alerts every pass.
it('the ledger enum mirrors the indexer boundary', () => {
  expect([...investorTransactionTypeValues]).toEqual([...INVESTOR_TRANSACTION_EVENT_TYPES]);
});

describe('buildEventId', () => {
  it('scopes identity by share class and spoke chain — one tx can carry same-type events across both', () => {
    const base = { centrifugeId: '1', txHash: '0xabc1', type: 'SYNC_DEPOSIT', account: '0xb8da' } as const;

    expect(buildEventId({ scId: '0x0001', event: base })).toBe('0x0001:1:0xabc1:SYNC_DEPOSIT:0xb8da');
    expect(buildEventId({ scId: '0x0002', event: base })).not.toBe(buildEventId({ scId: '0x0001', event: base }));
    expect(buildEventId({ scId: '0x0001', event: { ...base, centrifugeId: '12' } })).not.toBe(
      buildEventId({ scId: '0x0001', event: base })
    );
  });
});
