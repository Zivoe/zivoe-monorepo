import { beforeEach, describe, expect, it, vi } from 'vitest';

import { acceptAgreements } from './agreements';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isKycEnabled: vi.fn(),
  getRequiredStep: vi.fn(),
  canActForSubject: vi.fn(),
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
  captureException: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('@/server/verification/kyc-flag', () => ({ isKycEnabled: mocks.isKycEnabled }));
vi.mock('@/server/data/auth', () => ({ getRequiredStep: mocks.getRequiredStep }));
vi.mock('@/server/organizations', () => ({ organizations: { canActForSubject: mocks.canActForSubject } }));
// `insert(table).values(row).onConflictDoNothing(...)`: `values` records the row, the last call answers.
vi.mock('@/server/clients/db', () => ({
  db: {
    insert: () => ({
      values: (row: unknown) => (mocks.values(row), { onConflictDoNothing: mocks.onConflictDoNothing })
    })
  }
}));

const ORGANIZATION_ID = '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } });
  mocks.isKycEnabled.mockResolvedValue(true);
  mocks.getRequiredStep.mockResolvedValue(null);
  mocks.canActForSubject.mockResolvedValue(true);
  mocks.onConflictDoNothing.mockResolvedValue(undefined);
});

describe('acceptAgreements', () => {
  it('records the subject and the member who accepted for it', async () => {
    expect(await acceptAgreements({ subjectId: ORGANIZATION_ID })).toEqual({ ok: true });

    expect(mocks.canActForSubject).toHaveBeenCalledWith({ userId: 'user_1', subjectId: ORGANIZATION_ID });
    expect(mocks.values).toHaveBeenCalledWith({ subjectId: ORGANIZATION_ID, acceptedByUserId: 'user_1' });
  });

  it('refuses a subject the person cannot act for, writing nothing', async () => {
    mocks.canActForSubject.mockResolvedValue(false);

    expect(await acceptAgreements({ subjectId: ORGANIZATION_ID })).toEqual({ ok: false, code: 'not_member' });
    expect(mocks.values).not.toHaveBeenCalled();
  });

  it('refuses without a session, with the flag off, or behind the terms', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    expect(await acceptAgreements({ subjectId: ORGANIZATION_ID })).toEqual({ ok: false, code: 'unauthorized' });

    mocks.isKycEnabled.mockResolvedValueOnce(false);
    expect(await acceptAgreements({ subjectId: ORGANIZATION_ID })).toEqual({ ok: false, code: 'unauthorized' });

    mocks.getRequiredStep.mockResolvedValueOnce('/terms');
    expect(await acceptAgreements({ subjectId: ORGANIZATION_ID })).toEqual({ ok: false, code: 'unauthorized' });

    expect(mocks.values).not.toHaveBeenCalled();
  });

  it('answers a failed write as failed, and reports it', async () => {
    mocks.onConflictDoNothing.mockRejectedValue(new Error('connection lost'));

    expect(await acceptAgreements({ subjectId: ORGANIZATION_ID })).toEqual({ ok: false, code: 'failed' });
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
