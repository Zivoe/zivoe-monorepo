import { NextRequest } from 'next/server';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { proxy } from '@/proxy';

import { PERENA_DEMO_PATH } from './config';

const mocks = vi.hoisted((): { cookie: string | null } => ({ cookie: 'session' }));
vi.mock('better-auth/cookies', () => ({ getSessionCookie: () => mocks.cookie }));

beforeEach(() => {
  mocks.cookie = 'session';
  vi.stubEnv('PERENA_DEMO_ENABLED', 'true');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_ENV', 'development');
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('VERCEL_ENV', 'preview');
});
afterEach(() => vi.unstubAllEnvs());

function request(path = PERENA_DEMO_PATH) {
  return new NextRequest(`https://preview.example${path}`);
}

it.each([PERENA_DEMO_PATH, `${PERENA_DEMO_PATH}/`, `${PERENA_DEMO_PATH}?view=redeem`])(
  'returns a real HTTP 404 before streaming for disabled route %s',
  (path) => {
    vi.stubEnv('PERENA_DEMO_ENABLED', 'false');
    expect(proxy(request(path)).status).toBe(404);
    mocks.cookie = null;
    expect(proxy(request(path)).status).toBe(404);
  }
);

it('returns HTTP 404 in production even with an enabled flag and session cookie', () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  const response = proxy(request());
  expect(response.status).toBe(404);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it('retains the sign-in redirect when the demo is enabled', () => {
  expect(proxy(request()).status).toBe(200);
  mocks.cookie = null;
  expect(proxy(request()).headers.get('location')).toBe('https://preview.example/sign-in');
});

it('leaves existing vault paths behind the normal session check', () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  expect(proxy(request('/vaults/zivoe-smb-credit')).status).toBe(200);
  mocks.cookie = null;
  expect(proxy(request('/vaults/zivoe-smb-credit')).status).toBe(307);
});
