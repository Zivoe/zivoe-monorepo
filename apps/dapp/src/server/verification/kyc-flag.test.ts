import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as KycFlag from './kyc-flag';

const mocks = vi.hoisted(() => ({
  env: { NEXT_PUBLIC_ENV: 'production' },
  waitForLocalEvaluationReady: vi.fn(),
  isLocalEvaluationReady: vi.fn(),
  evaluateFlags: vi.fn(),
  isEnabled: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn()
}));

vi.mock('@/env', () => ({ env: mocks.env }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException, captureMessage: mocks.captureMessage }));
vi.mock('@/server/clients/posthog', () => ({
  posthog: {
    waitForLocalEvaluationReady: mocks.waitForLocalEvaluationReady,
    isLocalEvaluationReady: mocks.isLocalEvaluationReady,
    evaluateFlags: mocks.evaluateFlags
  }
}));

const USER = { id: 'user_1', email: 'alex@zivoe.com' };

// A fresh module per test: the first-load wait is per instance.
let isKycEnabled: typeof KycFlag.isKycEnabled;

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.env.NEXT_PUBLIC_ENV = 'production';
  mocks.waitForLocalEvaluationReady.mockResolvedValue(true);
  mocks.isLocalEvaluationReady.mockReturnValue(true);
  mocks.isEnabled.mockReturnValue(true);
  mocks.evaluateFlags.mockResolvedValue({ isEnabled: mocks.isEnabled });
  vi.resetModules();
  ({ isKycEnabled } = await import('./kyc-flag'));
});

describe('isKycEnabled', () => {
  it('is on outside production without asking PostHog', async () => {
    mocks.env.NEXT_PUBLIC_ENV = 'development';

    expect(await isKycEnabled({ user: USER })).toBe(true);
    expect(mocks.evaluateFlags).not.toHaveBeenCalled();
  });

  it('evaluates the flag locally, matching on the email', async () => {
    expect(await isKycEnabled({ user: USER })).toBe(true);
    expect(mocks.evaluateFlags).toHaveBeenCalledWith('user_1', {
      flagKeys: ['kyc'],
      personProperties: { email: 'alex@zivoe.com' },
      onlyEvaluateLocally: true
    });
    expect(mocks.isEnabled).toHaveBeenCalledWith('kyc');
  });

  it('is off when the flag is off', async () => {
    mocks.isEnabled.mockReturnValue(false);

    expect(await isKycEnabled({ user: USER })).toBe(false);
  });

  it('is off while the definitions are not loaded, waiting and reporting only once', async () => {
    mocks.waitForLocalEvaluationReady.mockResolvedValue(false);
    mocks.isLocalEvaluationReady.mockReturnValue(false);

    expect(await isKycEnabled({ user: USER })).toBe(false);
    expect(await isKycEnabled({ user: USER })).toBe(false);
    expect(mocks.waitForLocalEvaluationReady).toHaveBeenCalledTimes(1);
    expect(mocks.captureMessage).toHaveBeenCalledTimes(1);
    expect(mocks.evaluateFlags).not.toHaveBeenCalled();
  });

  it('reads the flag once the definitions arrive after the first wait', async () => {
    mocks.waitForLocalEvaluationReady.mockResolvedValue(false);
    mocks.isLocalEvaluationReady.mockReturnValueOnce(false).mockReturnValue(true);

    expect(await isKycEnabled({ user: USER })).toBe(false);
    expect(await isKycEnabled({ user: USER })).toBe(true);
  });

  it('is off, and reported, when PostHog throws', async () => {
    mocks.evaluateFlags.mockRejectedValue(new Error('boom'));

    expect(await isKycEnabled({ user: USER })).toBe(false);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
