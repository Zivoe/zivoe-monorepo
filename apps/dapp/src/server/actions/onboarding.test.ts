import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeOnboarding } from './onboarding';

// The action's own rules: the terms first, one profile, an organization only with the profile. The
// organization's own write is the Organizations module's, tested on Postgres.

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getTermsStatus: vi.fn(),
  isUserOnboarded: vi.fn(),
  create: vi.fn(),
  after: vi.fn(),
  inserted: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('@/server/data/auth', () => ({
  getTermsStatus: mocks.getTermsStatus,
  isUserOnboarded: mocks.isUserOnboarded
}));
vi.mock('@/server/organizations', () => ({ organizations: { create: mocks.create } }));
vi.mock('@/server/clients/qstash', () => ({ qstash: { publishJSON: vi.fn() } }));
vi.mock('@/server/utils/analytics', () => ({ captureServerEvent: vi.fn() }));
vi.mock('../utils/base-url', () => ({ BASE_URL: 'https://app.example' }));

/** A transaction whose profile insert answers `rows`: one row when it wrote, none when a profile was already there. */
const transaction = (rows: Array<{ id: string }>) => ({
  insert: () => ({
    values: (values: unknown) => {
      mocks.inserted(values);
      return { onConflictDoNothing: () => Object.assign(Promise.resolve(), { returning: async () => rows }) };
    }
  })
});
let profileRows: Array<{ id: string }> = [];
vi.mock('@/server/clients/db', () => ({
  db: { transaction: async (run: (tx: unknown) => unknown) => run(transaction(profileRows)) }
}));

const USER_ID = 'user_1';
const ORGANIZATION_ID = '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061';
const PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  countryOfResidence: 'GB',
  amountOfInterest: '10k_100k',
  referralSource: 'other'
} as const;
const ORGANIZATION = { name: 'Acme Capital LLC', countryOfIncorporation: 'US', title: 'Partner' };

beforeEach(() => {
  vi.clearAllMocks();
  profileRows = [{ id: USER_ID }];
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID, email: 'ada@example.com' } });
  mocks.getTermsStatus.mockResolvedValue('accepted');
  mocks.isUserOnboarded.mockResolvedValue(false);
  // The module runs the caller's writes inside its transaction, as the real one does.
  mocks.create.mockImplementation(async ({ before }: { before: (tx: unknown) => Promise<void> }) => {
    await before(transaction(profileRows));
    return { ok: true, value: { organizationId: ORGANIZATION_ID } };
  });
});

describe('completeOnboarding', () => {
  it('saves the profile and its subject, and sends the one-time welcome', async () => {
    expect(await completeOnboarding({ profile: PROFILE })).toEqual({ success: true });

    expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID, firstName: 'Ada' }));
    expect(mocks.inserted).toHaveBeenCalledWith({ id: USER_ID, kind: 'individual', userId: USER_ID });
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('saves nothing before the terms are accepted', async () => {
    mocks.getTermsStatus.mockResolvedValue('never');

    expect(await completeOnboarding({ profile: PROFILE, organization: ORGANIZATION })).toEqual({
      error: 'Unauthorized'
    });
    expect(mocks.inserted).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('creates the organization with the profile, in its transaction, and answers its id', async () => {
    expect(await completeOnboarding({ profile: PROFILE, organization: ORGANIZATION })).toEqual({
      success: true,
      organizationId: ORGANIZATION_ID
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, details: ORGANIZATION, before: expect.any(Function) })
    );
    expect(mocks.inserted).toHaveBeenCalledWith(expect.objectContaining({ id: USER_ID }));
  });

  it('says so, and writes nothing, for someone already onboarded', async () => {
    mocks.isUserOnboarded.mockResolvedValue(true);

    expect(await completeOnboarding({ profile: PROFILE, organization: ORGANIZATION })).toEqual({
      success: true,
      alreadyOnboarded: true
    });
    expect(mocks.inserted).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it('creates no organization when another tab saved the profile first', async () => {
    profileRows = [];
    mocks.create.mockImplementation(async ({ before }: { before: (tx: unknown) => Promise<void> }) => {
      await before(transaction(profileRows));
      throw new Error('unreachable: the profile insert found one already');
    });

    expect(await completeOnboarding({ profile: PROFILE, organization: ORGANIZATION })).toEqual({
      success: true,
      alreadyOnboarded: true
    });
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
