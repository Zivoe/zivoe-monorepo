import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/qstash', () => ({
  withQstashSignature: (handler: unknown) => handler,
  getQstashFailureCallback: () => 'http://localhost/api/qstash/failure',
  QSTASH_JOB_LABELS: { emailDepositReminderSecond: 'email.deposit-reminder.second' }
}));
vi.mock('@/server/clients/qstash', () => ({ qstash: { publishJSON: vi.fn().mockResolvedValue({}) } }));
vi.mock('@/server/utils/base-url', () => ({ BASE_URL: 'http://localhost' }));

const getUserEmailProfile = vi.hoisted(() => vi.fn());
vi.mock('@/server/data/auth', () => ({ getUserEmailProfile }));

const isEmailPreferenceEnabled = vi.hoisted(() => vi.fn());
vi.mock('@/server/data/email-preferences', () => ({ isEmailPreferenceEnabled }));

const getWalletAddressesForUser = vi.hoisted(() => vi.fn());
vi.mock('@/server/data/wallets', () => ({ getWalletAddressesForUser }));

const sendFirstDepositReminderEmail = vi.hoisted(() => vi.fn());
const sendSecondDepositReminderEmail = vi.hoisted(() => vi.fn());
vi.mock('@/server/utils/send-email', () => ({ sendFirstDepositReminderEmail, sendSecondDepositReminderEmail }));

import { POST } from './route';

const USER_ID = '2c9a0f9e-5a1b-4a5d-9c1e-6a1c2b3d4e5f';
const WALLET_A = '0xA28eF80d690844b586E192690D8FcDaECfD0281E';
const WALLET_B = '0xB8Da328a4EDB64AF841C6bB72B55988E9aBEb172';
const INDEXER_HOST = 'api-v3-test.cfg.embrio.tech';

let investorTransactionCount = 0;
let indexerAccountsSeen: Array<string> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  investorTransactionCount = 0;
  indexerAccountsSeen = undefined;

  getUserEmailProfile.mockResolvedValue({
    email: 'investor@example.com',
    firstName: 'Investor',
    lastName: null,
    accountType: 'individual',
    createdAt: new Date()
  });
  isEmailPreferenceEnabled.mockResolvedValue(true);
  getWalletAddressesForUser.mockResolvedValue([WALLET_A.toLowerCase()]);
  sendFirstDepositReminderEmail.mockResolvedValue(undefined);
  sendSecondDepositReminderEmail.mockResolvedValue(undefined);

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: { body?: string }) => {
      const url = input instanceof URL ? input.href : input;
      if (!url.includes(INDEXER_HOST)) throw new Error(`Unexpected fetch: ${url}`);

      const body = JSON.parse(init?.body ?? '{}') as { variables?: { accounts?: Array<string> } };
      indexerAccountsSeen = body.variables?.accounts;

      return new Response(
        JSON.stringify({ data: { investorTransactions: { totalCount: investorTransactionCount } } }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function reminderRequest(reminderNumber = 1) {
  return new NextRequest('http://localhost/api/email/deposit-reminder', {
    method: 'POST',
    body: JSON.stringify({ userId: USER_ID, reminderNumber })
  });
}

describe('POST /api/email/deposit-reminder', () => {
  it('suppresses the reminder when any investor-transaction row exists — any lifecycle type', async () => {
    // A deposited-then-redeemed user still has REDEEM_CLAIMED rows: totalCount
    // is type-agnostic, so they stay suppressed.
    investorTransactionCount = 1;

    const res = await POST(reminderRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: 'User already has investor activity, skipping reminder' });
    expect(sendFirstDepositReminderEmail).not.toHaveBeenCalled();
  });

  it('checks all of the user’s connected wallets in one query', async () => {
    getWalletAddressesForUser.mockResolvedValue([WALLET_A.toLowerCase(), WALLET_B.toLowerCase()]);
    investorTransactionCount = 1;

    await POST(reminderRequest());

    expect(indexerAccountsSeen).toEqual([WALLET_A.toLowerCase(), WALLET_B.toLowerCase()]);
  });

  it('sends the reminder when no investor transaction exists for any wallet', async () => {
    investorTransactionCount = 0;

    const res = await POST(reminderRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: 'Reminder 1 email sent' });
    expect(sendFirstDepositReminderEmail).toHaveBeenCalledOnce();
  });

  it('sends the reminder without querying the indexer when the user has no wallets', async () => {
    getWalletAddressesForUser.mockResolvedValue([]);

    const res = await POST(reminderRequest());
    expect(res.status).toBe(200);
    expect(sendFirstDepositReminderEmail).toHaveBeenCalledOnce();
    expect(indexerAccountsSeen).toBeUndefined();
  });
});
