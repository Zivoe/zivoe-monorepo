import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateInvestorProfile } from './investor-profile';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  captureException: vi.fn(),
  getKycStatus: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));
// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('@/server/kyc', () => ({ kycVerification: { getKycStatus: mocks.getKycStatus } }));
// `update(profile).set(values).where(...).returning(...)`: `set` records the values, `returning` answers.
vi.mock('@/server/clients/db', () => ({
  db: {
    update: () => ({ set: (values: unknown) => (mocks.set(values), { where: () => ({ returning: mocks.returning }) }) })
  }
}));

const DETAILS = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  countryOfResidence: 'United Kingdom of Great Britain and Northern Ireland (the)'
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } });
  mocks.returning.mockResolvedValue([{ id: 'user_1' }]);
  mocks.getKycStatus.mockResolvedValue({ canStart: true });
});

describe('updateInvestorProfile', () => {
  it('writes the confirmed details to the profile', async () => {
    expect(await updateInvestorProfile(DETAILS)).toEqual({ success: true });

    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining(DETAILS));
  });

  it('refuses without a session and touches nothing', async () => {
    mocks.getSession.mockResolvedValue(null);

    expect(await updateInvestorProfile(DETAILS)).toEqual({ error: 'Unauthorized' });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('refuses an empty name before reaching the database', async () => {
    expect(await updateInvestorProfile({ ...DETAILS, firstName: '' })).toEqual({ error: 'Invalid form data' });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('writes trimmed names', async () => {
    expect(await updateInvestorProfile({ ...DETAILS, firstName: '  Ada ' })).toEqual({ success: true });

    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Ada' }));
  });

  it.each([
    ['a blank name', { firstName: '   ' }],
    ['an overlong name', { lastName: 'x'.repeat(101) }],
    ['a country the select does not offer', { countryOfResidence: 'Narnia' }]
  ])('refuses %s before reaching the database', async (_, change) => {
    expect(await updateInvestorProfile({ ...DETAILS, ...change })).toEqual({ error: 'Invalid form data' });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('refuses once a verification can no longer start, and touches nothing', async () => {
    mocks.getKycStatus.mockResolvedValue({ canStart: false });

    expect((await updateInvestorProfile(DETAILS)).error).toMatch(/no longer be changed/);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('reports no matching individual profile as an error, not a success', async () => {
    mocks.returning.mockResolvedValue([]);

    const result = await updateInvestorProfile(DETAILS);

    expect(result.success).toBeUndefined();
    expect(result.error).toMatch(/individual/);
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it('captures a database failure and answers with a retryable error', async () => {
    mocks.returning.mockRejectedValue(new Error('connection reset'));

    const result = await updateInvestorProfile(DETAILS);

    expect(result.error).toMatch(/try again/i);
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });
});
