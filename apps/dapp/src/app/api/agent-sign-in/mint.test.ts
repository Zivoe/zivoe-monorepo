import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { describe, expect, it, vi } from 'vitest';

import { AGENT_ACCOUNT } from '@zivoe/database/agent';

import { authOptions } from '@/server/auth';

import { AGENT_SESSION_SECONDS, signInAsAgent } from './mint';

// Keep the real auth endpoints and cookies, with an isolated database and no sign-up side effects.
vi.mock('@/server/auth', async () => {
  const { memoryAdapter } = await import('better-auth/adapters/memory');
  return {
    authOptions: {
      baseURL: 'http://localhost:3000',
      secret: 'agent-sign-in-test-secret-abcdefghijklmnopqrstuvwxyz',
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      session: { cookieCache: { enabled: true, maxAge: 300 } },
      plugins: []
    } satisfies BetterAuthOptions
  };
});

describe('signInAsAgent', () => {
  it('replaces an existing cached identity with the agent and its one-hour session', async () => {
    let token = '';
    const customerAuth = betterAuth({
      ...authOptions,
      plugins: [
        magicLink({
          sendMagicLink: (issued) => {
            token = issued.token;
          }
        })
      ]
    });
    const cookies = new Map<string, string>();
    const headers = () => new Headers({ cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') });
    const applyCookies = (response: Response) => {
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';')[0]!;
        const equals = pair.indexOf('=');
        cookies.set(pair.slice(0, equals), pair.slice(equals + 1));
      }
    };

    await customerAuth.api.signInMagicLink({
      body: { email: 'customer@example.com', name: 'Existing customer' },
      headers: headers()
    });
    applyCookies(
      await customerAuth.api.magicLinkVerify({
        query: { token, callbackURL: '/' },
        headers: headers(),
        asResponse: true
      })
    );
    expect((await customerAuth.api.getSession({ headers: headers() }))?.user.email).toBe('customer@example.com');

    applyCookies(await signInAsAgent(new Request('http://localhost:3000/api/agent-sign-in', { headers: headers() })));

    const session = await customerAuth.api.getSession({ headers: headers() });
    expect(session?.user.email).toBe(AGENT_ACCOUNT.email);
    expect(session?.session.expiresAt.getTime()).toBeGreaterThan(Date.now() + (AGENT_SESSION_SECONDS - 10) * 1000);
    expect(session?.session.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + AGENT_SESSION_SECONDS * 1000);
  });
});
