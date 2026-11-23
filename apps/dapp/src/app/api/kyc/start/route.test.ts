import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isKycEnabled: vi.fn(),
  getRequiredStep: vi.fn(),
  canActForSubject: vi.fn(),
  hasAcceptedAgreements: vi.fn(),
  limit: vi.fn(),
  takeStartLock: vi.fn(),
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
vi.mock('@/server/verification/kyc-flag', () => ({ isKycEnabled: mocks.isKycEnabled }));
vi.mock('@/server/data/auth', () => ({ getRequiredStep: mocks.getRequiredStep }));
vi.mock('@/server/organizations', () => ({ organizations: { canActForSubject: mocks.canActForSubject } }));
vi.mock('@/server/data/agreements', () => ({ hasAcceptedAgreements: mocks.hasAcceptedAgreements }));
vi.mock('@/server/verification/start-lock', () => ({ takeStartLock: mocks.takeStartLock }));
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
  mocks.isKycEnabled.mockResolvedValue(true);
  mocks.getRequiredStep.mockResolvedValue(null);
  mocks.canActForSubject.mockResolvedValue(true);
  mocks.limit.mockResolvedValue({ success: true, reset: 0 });
  mocks.takeStartLock.mockResolvedValue({ release: vi.fn(async () => undefined) });
  mocks.startVerification.mockResolvedValue({ ok: true, value: { inquiryId: 'inq_1', sessionToken: 'tok_1' } });
});

describe('POST /api/kyc/start and the agreements', () => {
  it('starts nothing for a subject without an acceptance, before spending a rate-limit token', async () => {
    mocks.hasAcceptedAgreements.mockResolvedValue(false);

    const response = await start();

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'agreements_required' });
    expect(mocks.hasAcceptedAgreements).toHaveBeenCalledWith({ subjectId: ORGANIZATION_ID });
    expect(mocks.limit).not.toHaveBeenCalled();
    expect(mocks.takeStartLock).not.toHaveBeenCalled();
    expect(mocks.startVerification).not.toHaveBeenCalled();
  });

  it('starts once the subject has accepted', async () => {
    mocks.hasAcceptedAgreements.mockResolvedValue(true);

    const response = await start();

    expect(response.status).toBe(200);
    expect(mocks.startVerification).toHaveBeenCalledWith({ subjectId: ORGANIZATION_ID, actorUserId: 'user_1' });
  });
});
