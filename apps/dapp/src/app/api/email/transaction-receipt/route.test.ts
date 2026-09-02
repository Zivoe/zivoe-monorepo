import { NextRequest } from 'next/server';

import { describe, expect, it, vi } from 'vitest';

import { runReceiptMailer } from '@/server/utils/centrifuge-tx-receipt-mailer';

import { POST } from './route';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
// Signature verification is QStash's contract; the route's own is under test.
vi.mock('@/lib/qstash', async (importOriginal) => ({
  ...(await importOriginal()),
  withQstashSignature: (handler: unknown) => handler
}));
vi.mock('@/server/utils/centrifuge-tx-receipt-mailer', () => ({ runReceiptMailer: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ setTag: vi.fn(), captureException: vi.fn() }));

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

function post(body: string) {
  return POST(
    new NextRequest('http://localhost/api/email/transaction-receipt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    })
  );
}

describe('POST /api/email/transaction-receipt', () => {
  it('parses the job (amounts to bigint) and reports the mailer outcome', async () => {
    vi.mocked(runReceiptMailer).mockResolvedValue({ outcome: 'sent' });

    const response = await post(JSON.stringify(JOB));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { outcome: 'sent' } });
    expect(runReceiptMailer).toHaveBeenCalledWith(
      expect.objectContaining({ event: expect.objectContaining({ tokenAmount: 1000000000000000000n }) })
    );
  });

  it.each([
    { label: 'a negative amount', body: JSON.stringify({ ...JOB, event: { ...JOB.event, tokenAmount: '-1' } }) },
    { label: 'a slug that could reshape the CTA URL', body: JSON.stringify({ ...JOB, zivoeVaultSlug: 'x/../y' }) },
    { label: 'a non-JSON body', body: 'not json' }
  ])('answers $label with the non-retryable 489 — a retry cannot fix a contract bug', async ({ body }) => {
    vi.mocked(runReceiptMailer).mockClear();

    const response = await post(body);

    expect(response.status).toBe(489);
    expect(response.headers.get('Upstash-NonRetryable-Error')).toBe('true');
    expect(runReceiptMailer).not.toHaveBeenCalled();
  });
});
