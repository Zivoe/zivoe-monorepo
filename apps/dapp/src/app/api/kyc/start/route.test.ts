import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getOnboardingStep: vi.fn(),
  limit: vi.fn(),
  startVerification: vi.fn()
}));

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));
vi.mock('@sentry/nextjs', () => ({ setTag: vi.fn(), captureException: vi.fn() }));
vi.mock('@vercel/functions', () => ({ ipAddress: () => '127.0.0.1' }));
vi.mock('@/server/clients/redis', () => ({ redis: {} }));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    vi.fn(() => ({ limit: mocks.limit })),
    { fixedWindow: vi.fn() }
  )
}));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('@/server/verification/kyc-flag', () => ({ isKycEnabled: async () => true }));
// Only the onboarding step: the agreements gate is not this route's to ask.
vi.mock('@/server/data/auth', () => ({ getOnboardingStep: mocks.getOnboardingStep }));
vi.mock('@/server/organizations', () => ({ organizations: { canActForSubject: async () => true } }));
vi.mock('@/server/verification/start-lock', () => ({
  takeStartLock: async () => ({ release: async () => undefined })
}));
vi.mock('@/server/verification', () => ({ verification: { startVerification: mocks.startVerification } }));

const ORGANIZATION_ID = '9b1c2d3e-4f50-4a61-8b72-1c2d3e4f5061';

const start = () =>
  POST(
    new NextRequest('http://localhost/api/kyc/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subjectId: ORGANIZATION_ID })
    })
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } });
  mocks.getOnboardingStep.mockResolvedValue(null);
  mocks.limit.mockResolvedValue({ success: true, reset: 0 });
  mocks.startVerification.mockResolvedValue({ ok: true, value: { inquiryId: 'inq_1', sessionToken: 'tok_1' } });
});

describe('POST /api/kyc/start', () => {
  it('starts for someone the agreements gate holds: they may verify another account first', async () => {
    const response = await start();

    expect(response.status).toBe(200);
    expect(mocks.startVerification).toHaveBeenCalledWith({ subjectId: ORGANIZATION_ID, actorUserId: 'user_1' });
  });

  it('starts nothing behind the terms or onboarding', async () => {
    mocks.getOnboardingStep.mockResolvedValue('/terms');

    expect((await start()).status).toBe(403);
    expect(mocks.startVerification).not.toHaveBeenCalled();
  });
});
