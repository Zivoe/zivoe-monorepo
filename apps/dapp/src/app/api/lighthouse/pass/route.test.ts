import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LIGHTHOUSE_URL } from '@/lib/lighthouse';

import { GET } from './route';

const mocks = vi.hoisted(() => {
  const env: { LIGHTHOUSE_PASS_SECRET?: string } = {};
  return { env, getUser: vi.fn(), isUserOnboarded: vi.fn() };
});
vi.mock('@/env', () => ({ env: mocks.env }));
vi.mock('@/server/data/auth', () => ({ getUser: mocks.getUser, isUserOnboarded: mocks.isUserOnboarded }));

const DAPP = 'http://localhost:3000';
const PAGE = `${LIGHTHOUSE_URL}/liquidity`;

const visit = (next?: string) => {
  const url = new URL('/api/lighthouse/pass', DAPP);
  if (next) url.searchParams.set('next', next);

  return GET(new NextRequest(url));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.LIGHTHOUSE_PASS_SECRET = 'lighthouse-pass-route-test-secret-32ch';
  mocks.getUser.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.isUserOnboarded.mockResolvedValue(true);
});

describe('GET /api/lighthouse/pass', () => {
  it('issues a 24-hour pass to a signed-in, onboarded user and returns them to the Lighthouse page', async () => {
    const response = await visit(PAGE);

    expect(response.headers.get('location')).toBe(`${PAGE}?pass=1`);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    // Host-only and not Secure here, because the dapp under test is served from http://localhost.
    expect(response.headers.get('set-cookie')).toMatch(
      /^lighthouse-pass=\d{10}\.[\w-]{43}; Path=\/; Expires=[^;]+; Max-Age=86400; HttpOnly; SameSite=lax$/
    );
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });

  it('falls back to the Lighthouse home page when `next` is absent or not a Lighthouse page', async () => {
    expect((await visit()).headers.get('location')).toBe(`${LIGHTHOUSE_URL}/?pass=1`);
    expect((await visit('https://evil.example/liquidity')).headers.get('location')).toBe(`${LIGHTHOUSE_URL}/?pass=1`);
  });

  it('sends a signed-out visitor to sign-in with `next` and a not-onboarded one to onboarding without it, and no pass', async () => {
    mocks.isUserOnboarded.mockResolvedValue(false);
    const notOnboarded = await visit(PAGE);

    mocks.getUser.mockResolvedValue({ user: undefined });
    const signedOut = await visit(PAGE);

    expect(notOnboarded.headers.get('location')).toBe(`${DAPP}/onboarding`);
    expect(signedOut.headers.get('location')).toBe(`${DAPP}/sign-in?next=${encodeURIComponent(PAGE)}`);

    for (const response of [notOnboarded, signedOut]) {
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    }
  });

  it('fails with 503, without a pass or a redirect, when the secret is not configured', async () => {
    mocks.env.LIGHTHOUSE_PASS_SECRET = undefined;

    const response = await visit(PAGE);

    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
