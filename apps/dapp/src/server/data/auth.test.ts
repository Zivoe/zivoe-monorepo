import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOnboardingStep, getRequiredStep } from './auth';

const state = vi.hoisted(
  (): {
    terms: { hasAcceptedLatest: boolean; hasAcceptedAny: boolean };
    onboarded: boolean;
    agreements: { status: 'accepted' | 'outdated' | 'never'; actsForApproved: boolean };
  } => ({
    terms: { hasAcceptedLatest: true, hasAcceptedAny: true },
    onboarded: true,
    agreements: { status: 'accepted', actsForApproved: true }
  })
);

vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/server/data/agreements', () => ({ getAgreementsAccess: async () => state.agreements }));
// The terms read ends at `where`, the onboarding read at `limit`: each answers from `state`.
vi.mock('@/server/clients/db', async () => {
  const { profile } = await import('@zivoe/database/schema');
  const NOW = new Date();
  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () =>
            table === profile
              ? { limit: async () => (state.onboarded ? [{ id: 'user_1', createdAt: NOW }] : []) }
              : Promise.resolve([state.terms])
        })
      })
    }
  };
});

beforeEach(() => {
  state.terms = { hasAcceptedLatest: true, hasAcceptedAny: true };
  state.onboarded = true;
  state.agreements = { status: 'accepted', actsForApproved: true };
});

describe('getRequiredStep', () => {
  it('asks for the terms, then onboarding, before the agreements', async () => {
    state.agreements = { status: 'never', actsForApproved: true };
    state.onboarded = false;
    state.terms = { hasAcceptedLatest: false, hasAcceptedAny: true };
    expect(await getRequiredStep('user_1')).toBe('/terms');

    state.terms = { hasAcceptedLatest: true, hasAcceptedAny: true };
    expect(await getRequiredStep('user_1')).toBe('/onboarding');

    state.onboarded = true;
    expect(await getRequiredStep('user_1')).toBe('/agreements');
  });

  it('holds anyone who acts for an approved account until they accept the version in force', async () => {
    state.agreements = { status: 'outdated', actsForApproved: true };
    expect(await getRequiredStep('user_1')).toBe('/agreements');

    state.agreements = { status: 'accepted', actsForApproved: true };
    expect(await getRequiredStep('user_1')).toBeNull();
  });

  it('lets through anyone who acts for no approved account, whatever they accepted', async () => {
    state.agreements = { status: 'outdated', actsForApproved: false };
    expect(await getRequiredStep('user_1')).toBeNull();
  });
});

describe('getOnboardingStep', () => {
  it('never asks for the agreements, so /verification and acceptAgreements stay open', async () => {
    state.agreements = { status: 'never', actsForApproved: true };
    expect(await getOnboardingStep('user_1')).toBeNull();
  });
});
