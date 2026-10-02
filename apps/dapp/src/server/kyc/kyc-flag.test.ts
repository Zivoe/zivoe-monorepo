import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as KycFlag from './kyc-flag';

const mocks = vi.hoisted(() => ({
  env: { NEXT_PUBLIC_ENV: 'production' },
  waitForLocalEvaluationReady: vi.fn(),
  isLocalEvaluationReady: vi.fn(),
  isFeatureEnabled: vi.fn(),
  captureException: vi.fn()
}));

vi.mock('@/env', () => ({ env: mocks.env }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));
vi.mock('@/server/clients/posthog', () => ({
  posthog: {
    waitForLocalEvaluationReady: mocks.waitForLocalEvaluationReady,
    isLocalEvaluationReady: mocks.isLocalEvaluationReady,
    isFeatureEnabled: mocks.isFeatureEnabled
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
  mocks.isFeatureEnabled.mockResolvedValue(true);
  vi.resetModules();
  ({ isKycEnabled } = await import('./kyc-flag'));
});

describe('isKycEnabled', () => {
  it('is on outside production without asking PostHog', async () => {
    mocks.env.NEXT_PUBLIC_ENV = 'development';

    expect(await isKycEnabled({ user: USER })).toBe(true);
    expect(mocks.isFeatureEnabled).not.toHaveBeenCalled();
  });

  it('evaluates the flag locally, matching on the email', async () => {
    expect(await isKycEnabled({ user: USER })).toBe(true);
    expect(mocks.isFeatureEnabled).toHaveBeenCalledWith('kyc', 'user_1', {
      personProperties: { email: 'alex@zivoe.com' },
      onlyEvaluateLocally: true,
      sendFeatureFlagEvents: false
    });
  });

  it.each([false, undefined])('is off when the flag answers %s', async (answer) => {
    mocks.isFeatureEnabled.mockResolvedValue(answer);

    expect(await isKycEnabled({ user: USER })).toBe(false);
  });

  it('is off while the definitions are not loaded, waiting for them only once', async () => {
    mocks.waitForLocalEvaluationReady.mockResolvedValue(false);
    mocks.isLocalEvaluationReady.mockReturnValue(false);

    expect(await isKycEnabled({ user: USER })).toBe(false);
    expect(await isKycEnabled({ user: USER })).toBe(false);
    expect(mocks.waitForLocalEvaluationReady).toHaveBeenCalledTimes(1);
    expect(mocks.isFeatureEnabled).not.toHaveBeenCalled();
  });

  it('is off, and reported, when PostHog throws', async () => {
    mocks.isFeatureEnabled.mockRejectedValue(new Error('boom'));

    expect(await isKycEnabled({ user: USER })).toBe(false);
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
