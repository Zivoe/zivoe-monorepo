import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), isKycEnabled: vi.fn() }));

vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('@/server/verification/kyc-flag', () => ({ isKycEnabled: mocks.isKycEnabled }));

const get = (file: string) =>
  GET(new NextRequest(`http://localhost/documents/${file}`), { params: Promise.resolve({ file }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user_1' } });
  mocks.isKycEnabled.mockResolvedValue(true);
});

describe('GET /documents/[file]', () => {
  it('serves a listed PDF to a signed-in session, privately', async () => {
    const response = await get('offering-supplement.pdf');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it('sends a cookie without a valid session to sign-in', async () => {
    mocks.getSession.mockResolvedValue(null);

    const response = await get('confidential-offering-memorandum.pdf');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/sign-in');
  });

  it('answers 404 for anyone the kyc flag is off for, and for any name it does not list', async () => {
    mocks.isKycEnabled.mockResolvedValue(false);
    expect((await get('master-lending-agreement.pdf')).status).toBe(404);

    mocks.isKycEnabled.mockResolvedValue(true);
    expect((await get('../package.json')).status).toBe(404);
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });
});
