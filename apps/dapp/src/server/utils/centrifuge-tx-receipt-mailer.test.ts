import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getShareClassIdentity } from '@zivoe/centrifuge-indexer';
import { transactionEmailSent, user } from '@zivoe/database/schema';

import { isEmailPreferenceEnabled } from '@/server/data/email-preferences';
import { sendTransactionReceiptEmail } from '@/server/utils/send-email';

import { type TransactionReceiptJob } from './centrifuge-tx-receipt-job';
import { runReceiptMailer } from './centrifuge-tx-receipt-mailer';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@zivoe/centrifuge-indexer', async (importOriginal) => ({
  ...(await importOriginal()),
  getShareClassIdentity: vi.fn()
}));
vi.mock('@/server/data/email-preferences', () => ({ isEmailPreferenceEnabled: vi.fn() }));
vi.mock('@/server/utils/send-email', () => ({ sendTransactionReceiptEmail: vi.fn() }));

/** Table-dispatched stand-in for the two reads and one insert the mailer performs. */
const state = {
  userEmail: null as string | null,
  alreadySent: false,
  inserted: [] as Array<Record<string, unknown>>
};

vi.mock('@/server/clients/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            if (table === user) return state.userEmail === null ? [] : [{ email: state.userEmail }];
            if (table === transactionEmailSent) return state.alreadySent ? [{ id: 'row' }] : [];
            throw new Error('unexpected table in select');
          }
        })
      })
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoNothing: async () => {
          if (table !== transactionEmailSent) throw new Error('unexpected insert table');
          state.inserted.push(values);
        }
      })
    })
  }
}));

const JOB: TransactionReceiptJob = {
  eventId: '0xsc:1:0xtx:SYNC_DEPOSIT:0xabc',
  userId: '3f1f9a5e-53a5-4bb5-9129-c1c1f6a4a111',
  vaultSlug: 'zsmb',
  shareClassKey: 'zsmb',
  event: {
    type: 'SYNC_DEPOSIT',
    account: '0xabc',
    txHash: '0xtx',
    chainId: 11155111,
    chainName: 'ethereum',
    explorerUrl: null,
    centrifugeId: '1',
    tokenAmount: 1000000000000000000n,
    currencyAmount: 1000000n,
    createdAtMs: 1786000000000
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  state.userEmail = 'a@b.c';
  state.alreadySent = false;
  state.inserted = [];
  vi.mocked(isEmailPreferenceEnabled).mockResolvedValue(true);
  vi.mocked(getShareClassIdentity).mockReturnValue({
    key: 'zsmb',
    symbol: 'zSMB',
    decimals: 18,
    poolId: '281474976720680',
    scId: '0xsc'
  });
  vi.mocked(sendTransactionReceiptEmail).mockResolvedValue({ data: null });
});

describe('runReceiptMailer', () => {
  it('sends with catalog identity and the vault deep link, then records the dedupe row', async () => {
    const result = await runReceiptMailer(JOB);

    expect(result).toEqual({ outcome: 'sent' });
    expect(sendTransactionReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.c',
        userId: JOB.userId,
        symbol: 'zSMB',
        shareDecimals: 18,
        viewInAppUrl: expect.stringMatching(/\/vaults\/zsmb$/)
      })
    );
    expect(state.inserted).toEqual([
      {
        eventId: JOB.eventId,
        txHash: '0xtx',
        userId: JOB.userId,
        walletAddress: '0xabc',
        eventType: 'SYNC_DEPOSIT'
      }
    ]);
  });

  it('a disabled transaction_receipts preference skips the send and records nothing', async () => {
    vi.mocked(isEmailPreferenceEnabled).mockResolvedValue(false);

    const result = await runReceiptMailer(JOB);

    expect(result).toEqual({ outcome: 'skipped', reason: 'preference_disabled' });
    expect(isEmailPreferenceEnabled).toHaveBeenCalledWith({ userId: JOB.userId, bucket: 'transaction_receipts' });
    expect(sendTransactionReceiptEmail).not.toHaveBeenCalled();
    expect(state.inserted).toHaveLength(0);
  });

  it('an already-recorded (event, user) pair never mails twice', async () => {
    state.alreadySent = true;

    const result = await runReceiptMailer(JOB);

    expect(result).toEqual({ outcome: 'skipped', reason: 'already_sent' });
    expect(sendTransactionReceiptEmail).not.toHaveBeenCalled();
  });

  it('a deleted user is a normal end state, not an error', async () => {
    state.userEmail = null;

    const result = await runReceiptMailer(JOB);

    expect(result).toEqual({ outcome: 'skipped', reason: 'user_not_found' });
    expect(sendTransactionReceiptEmail).not.toHaveBeenCalled();
  });

  it('a failed send records nothing — the retry re-sends and Resend dedupes', async () => {
    vi.mocked(sendTransactionReceiptEmail).mockRejectedValue(new Error('resend down'));

    await expect(runReceiptMailer(JOB)).rejects.toThrow('resend down');

    expect(state.inserted).toHaveLength(0);
  });

  it('an unknown share-class key throws before any send — the trust boundary holds', async () => {
    vi.mocked(getShareClassIdentity).mockImplementation(() => {
      throw new Error('Share class "zalt" is not in the catalog.');
    });

    await expect(runReceiptMailer({ ...JOB, shareClassKey: 'zalt' })).rejects.toThrow('not in the catalog');

    expect(sendTransactionReceiptEmail).not.toHaveBeenCalled();
    expect(state.inserted).toHaveLength(0);
  });
});
