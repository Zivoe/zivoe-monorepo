import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

// The route reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
// Signature verification is QStash's contract; the route's own is under test.
vi.mock('@/lib/qstash', async (importOriginal) => ({
  ...(await importOriginal()),
  withQstashSignature: (handler: unknown) => handler
}));
const { reconcile, sendBatchedTelegramMessages, captureCheckIn } = vi.hoisted(() => ({
  reconcile: vi.fn(),
  sendBatchedTelegramMessages: vi.fn(),
  captureCheckIn: vi.fn()
}));
vi.mock('@/server/wallet-link', () => ({ walletLink: { reconcile } }));
vi.mock('@/server/utils/send-telegram', () => ({ sendBatchedTelegramMessages }));
vi.mock('@/env', () => ({ env: { TELEGRAM_WALLET_LINK_CHAT_ID: 'wallet-link-chat' } }));
vi.mock('@sentry/nextjs', () => ({
  setTag: vi.fn(),
  captureCheckIn,
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  flush: vi.fn(),
  logger: { info: vi.fn() }
}));

const STALLED = { linkId: 'link_1', address: '0xabc', admittedOn: 0, total: 2, daysWaiting: 3, isLastReminder: false };
const REPORT = {
  checked: 1,
  whitelisted: 0,
  revoked: 0,
  restored: 0,
  unchecked: 0,
  unscreened: 0,
  stuck: [STALLED],
  lapsed: [],
  stillAdmitted: [],
  flagged: []
};

const run = (query = '') =>
  POST(new NextRequest(`http://localhost/api/wallet-link/reconcile${query}`, { method: 'POST' }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  reconcile.mockResolvedValue(REPORT);
  sendBatchedTelegramMessages.mockResolvedValue(undefined);
  captureCheckIn.mockReturnValue('check-in-1');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/wallet-link/reconcile', () => {
  it('posts the stalled digest on the scheduled 09:00 run, and checks in with the monitor', async () => {
    vi.setSystemTime(new Date('2026-10-30T09:00:04.000Z'));

    expect((await run()).status).toBe(200);
    expect(sendBatchedTelegramMessages).toHaveBeenCalledTimes(1);
    expect(captureCheckIn).toHaveBeenCalledWith(expect.objectContaining({ checkInId: 'check-in-1', status: 'ok' }));
  });

  it('lists the drift both ways in the digest, a section each, and posts nothing when there is none', async () => {
    vi.setSystemTime(new Date('2026-10-30T09:00:04.000Z'));
    reconcile.mockResolvedValueOnce({
      ...REPORT,
      stuck: [],
      lapsed: [{ linkId: 'link_2', address: '0xdef', admittedOn: 1, total: 2 }],
      stillAdmitted: [{ linkId: 'link_3', address: '0x123', admittedOn: 2, total: 2 }]
    });

    await run();
    expect(sendBatchedTelegramMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          '<b>Wallet link: whitelisted before, not now</b>',
          '<code>0xdef</code> · admitted on 1 of 2 chains',
          '<b>Wallet link: revoke asked, still admitted</b>',
          '<code>0x123</code> · admitted on 2 of 2 chains'
        ]
      })
    );

    vi.clearAllMocks();
    reconcile.mockResolvedValueOnce({ ...REPORT, stuck: [] });
    await run();
    expect(sendBatchedTelegramMessages).not.toHaveBeenCalled();
  });

  it('sweeps on the later scheduled runs of the digest hour without repeating the digest', async () => {
    vi.setSystemTime(new Date('2026-10-30T09:15:03.000Z'));

    expect((await run()).status).toBe(200);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(sendBatchedTelegramMessages).not.toHaveBeenCalled();
    expect(captureCheckIn).toHaveBeenCalledWith(expect.objectContaining({ checkInId: 'check-in-1', status: 'ok' }));
  });

  it('sweeps on a triggered run inside the digest hour without repeating the digest or checking in', async () => {
    vi.setSystemTime(new Date('2026-10-30T09:20:00.000Z'));

    expect((await run('?trigger=verification')).status).toBe(200);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(sendBatchedTelegramMessages).not.toHaveBeenCalled();
    expect(captureCheckIn).not.toHaveBeenCalled();
  });
});
