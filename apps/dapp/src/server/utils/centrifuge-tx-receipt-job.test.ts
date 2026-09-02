import { describe, expect, it } from 'vitest';

import { buildReceiptJobKey, transactionReceiptJobSchema } from './centrifuge-tx-receipt-job';

/** A payload exactly as the Transaction Monitor publishes it — amounts still strings. */
const JOB = {
  eventId: '0xsc:1:0xtx:SYNC_DEPOSIT:0xabc',
  userId: '3f1f9a5e-53a5-4bb5-9129-c1c1f6a4a111',
  zivoeVaultSlug: 'zivoe-smb-credit',
  shareClassKey: 'zsmb',
  event: {
    type: 'SYNC_DEPOSIT',
    account: '0xabc',
    txHash: '0xtx',
    chainId: 11155111,
    chainName: 'ethereum',
    explorerUrl: null,
    centrifugeId: '1',
    tokenAmount: '1000000000000000000',
    currencyAmount: '1000000',
    createdAtMs: 1786000000000
  }
};

describe('transactionReceiptJobSchema', () => {
  it('parses the monitor payload, amounts to bigint', () => {
    const parsed = transactionReceiptJobSchema.parse(JOB);

    expect(parsed.event.tokenAmount).toBe(1000000000000000000n);
    expect(parsed.event.currencyAmount).toBe(1000000n);
    expect(parsed.zivoeVaultSlug).toBe('zivoe-smb-credit');
  });

  it('keeps null amounts null — the template renders them as a dash', () => {
    const parsed = transactionReceiptJobSchema.parse({ ...JOB, event: { ...JOB.event, tokenAmount: null } });

    expect(parsed.event.tokenAmount).toBeNull();
  });

  it.each(['-1', '1.5', '1e18', '', ' 1'])('rejects an amount that is not an unsigned integer: %j', (amount) => {
    expect(
      transactionReceiptJobSchema.safeParse({ ...JOB, event: { ...JOB.event, tokenAmount: amount } }).success
    ).toBe(false);
  });

  it.each(['Zivoe-SMB', 'zivoe_smb', 'x/../y', 'a?b=c', ''])(
    'rejects a slug that could reshape the CTA URL: %j',
    (slug) => {
      expect(transactionReceiptJobSchema.safeParse({ ...JOB, zivoeVaultSlug: slug }).success).toBe(false);
    }
  );

  it('rejects an event type outside the alerting surface', () => {
    expect(
      transactionReceiptJobSchema.safeParse({ ...JOB, event: { ...JOB.event, type: 'TRANSFER_IN' } }).success
    ).toBe(false);
  });
});

describe('buildReceiptJobKey', () => {
  it('is a stable 64-hex digest that differs per user', () => {
    const key = buildReceiptJobKey({ eventId: JOB.eventId, userId: JOB.userId });

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(buildReceiptJobKey({ eventId: JOB.eventId, userId: JOB.userId })).toBe(key);
    expect(buildReceiptJobKey({ eventId: JOB.eventId, userId: 'other' })).not.toBe(key);
  });
});
