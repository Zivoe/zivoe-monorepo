import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LATEST_AGREEMENTS_VERSION } from '@/lib/agreements';

import { acceptAgreements } from './agreements';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getOnboardingStep: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  captureServerEvent: vi.fn(),
  captureException: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/server', () => ({ after: (run: () => unknown) => run() }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('@/server/data/auth', () => ({ getOnboardingStep: mocks.getOnboardingStep }));
vi.mock('@/server/utils/analytics', () => ({ captureServerEvent: mocks.captureServerEvent }));
// `insert(table).values(row).onConflictDoNothing().returning(...)`: `values` records the row, `returning` answers.
vi.mock('@/server/clients/db', () => ({
  db: {
    insert: () => ({
      values: (row: unknown) => (mocks.values(row), { onConflictDoNothing: () => ({ returning: mocks.returning }) })
    })
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } });
  mocks.getOnboardingStep.mockResolvedValue(null);
  mocks.returning.mockResolvedValue([{ id: 'acceptance_1' }]);
});

describe('acceptAgreements', () => {
  it('records the person and the version they accepted, once', async () => {
    expect(await acceptAgreements({ version: LATEST_AGREEMENTS_VERSION })).toEqual({ ok: true });

    expect(mocks.values).toHaveBeenCalledWith({ userId: 'user_1', agreementsVersion: LATEST_AGREEMENTS_VERSION });
    expect(mocks.captureServerEvent).toHaveBeenCalledWith({
      distinctId: 'user_1',
      event: 'agreements:accepted',
      properties: { agreements_version: LATEST_AGREEMENTS_VERSION }
    });
  });

  it('answers a repeat as done, without a second analytics event', async () => {
    mocks.returning.mockResolvedValue([]);

    expect(await acceptAgreements({ version: LATEST_AGREEMENTS_VERSION })).toEqual({ ok: true });
    expect(mocks.captureServerEvent).not.toHaveBeenCalled();
  });

  it('refuses a version other than the one in force, writing nothing', async () => {
    expect(await acceptAgreements({ version: '2000-01-01' })).toEqual({ ok: false, code: 'outdated' });
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it('refuses without a session or behind the terms or onboarding, writing nothing', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    expect(await acceptAgreements({ version: LATEST_AGREEMENTS_VERSION })).toEqual({
      ok: false,
      code: 'unauthorized'
    });

    mocks.getOnboardingStep.mockResolvedValueOnce('/terms');
    expect(await acceptAgreements({ version: LATEST_AGREEMENTS_VERSION })).toEqual({
      ok: false,
      code: 'unauthorized'
    });

    expect(mocks.values).not.toHaveBeenCalled();
  });

  it('answers a failed write as failed, and reports it', async () => {
    mocks.returning.mockRejectedValue(new Error('connection lost'));

    expect(await acceptAgreements({ version: LATEST_AGREEMENTS_VERSION })).toEqual({ ok: false, code: 'failed' });
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
