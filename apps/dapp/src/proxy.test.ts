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

  it("keeps an organization's subject on /verification as the way back, and nothing else", () => {
    const subject = '0600cf8f-f4a7-4b91-a9c8-ea55919f48e2';
    const nextOf = (url: string) =>
      new URL(proxy(new NextRequest(url)).headers.get('location') ?? '').searchParams.get('next');

    expect(nextOf(`https://app.zivoe.com/verification?subject=${subject}`)).toBe(`/verification?subject=${subject}`);
    expect(nextOf(`https://app.zivoe.com/verification?subject=${subject}&step=identity`)).toBe(
      `/verification?subject=${subject}`
    );
    expect(nextOf('https://app.zivoe.com/verification?subject=https://evil.example')).toBe('/verification');
  });
});
