import { NextRequest } from 'next/server';

import { describe, expect, it, vi } from 'vitest';

import { proxy } from './proxy';

vi.mock('better-auth/cookies', () => ({ getSessionCookie: () => null }));

describe('proxy', () => {
  it('sends a signed-out visitor to sign-in with the campaign parameters and nothing else', () => {
    const response = proxy(new NextRequest('https://app.zivoe.com/?utm_source=x&utm_campaign=launch&ref=abc'));

    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/sign-in');
    expect(Object.fromEntries(location.searchParams)).toEqual({ utm_source: 'x', utm_campaign: 'launch' });
  });
});
