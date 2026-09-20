import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LIGHTHOUSE_URL } from '@/lib/lighthouse';

import { GET } from './route';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), isUserOnboarded: vi.fn() }));
vi.mock('@/server/data/auth', () => mocks);

const DAPP = 'http://localhost:3000';
const PAGE = `${LIGHTHOUSE_URL}/liquidity`;

const destination = async (next?: string) => {
  const url = new URL('/api/auth/post-signin', DAPP);
  if (next) url.searchParams.set('next', next);

  return (await GET(new NextRequest(url))).headers.get('location');
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.isUserOnboarded.mockResolvedValue(true);
});

describe('GET /api/auth/post-signin', () => {
  it('sends an onboarded user to the dapp, or to the pass route on their way back to Lighthouse', async () => {
    expect(await destination()).toBe(`${DAPP}/`);
    expect(await destination(PAGE)).toBe(`${DAPP}/api/lighthouse/pass?next=${encodeURIComponent(PAGE)}`);
  });

  it('never redirects to a `next` outside Lighthouse', async () => {
    expect(await destination('https://evil.example/liquidity')).toBe(`${DAPP}/`);
  });

  it('keeps the Lighthouse page through onboarding for a user who has not onboarded, and through sign-in', async () => {
    mocks.isUserOnboarded.mockResolvedValue(false);
    expect(await destination()).toBe(`${DAPP}/onboarding`);
    expect(await destination(PAGE)).toBe(`${DAPP}/onboarding?next=${encodeURIComponent(PAGE)}`);

    mocks.getUser.mockResolvedValue({ user: undefined });
    expect(await destination(PAGE)).toBe(`${DAPP}/sign-in?next=${encodeURIComponent(PAGE)}`);
  });
});
