import { beforeEach, describe, expect, it, vi } from 'vitest';

import { captureServerEvent } from './analytics';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
  captureImmediate: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: mocks.headers, cookies: mocks.cookies }));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_VERCEL_ENV: 'production', NEXT_PUBLIC_CHAIN_ENV: 'testnet', NEXT_PUBLIC_POSTHOG_KEY: 'phc_test' }
}));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('../clients/posthog', () => ({ posthog: { captureImmediate: mocks.captureImmediate } }));

/** The request's cookies, with PostHog's own cookie holding a session started `ageMs` and last active `idleMs` ago. */
const posthogCookie = ({ idleMs, ageMs = idleMs }: { idleMs: number; ageMs?: number }) => ({
  get: (name: string) =>
    name === 'ph_phc_test_posthog'
      ? { value: JSON.stringify({ $sesid: [Date.now() - idleMs, 'session_cookie', Date.now() - ageMs] }) }
      : undefined
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.headers.mockResolvedValue(new Headers());
  mocks.cookies.mockResolvedValue({ get: () => undefined });
});

describe('captureServerEvent', () => {
  it("puts the event in the browser's PostHog session", async () => {
    mocks.headers.mockResolvedValue(new Headers({ 'x-posthog-session-id': 'session_1' }));

    await captureServerEvent({
      distinctId: 'user_1',
      event: 'wallet_connected',
      properties: { wallet_type: 'metamask' }
    });

    expect(mocks.captureImmediate).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { wallet_type: 'metamask', $session_id: 'session_1' } })
    );
    expect(mocks.cookies).not.toHaveBeenCalled();
  });

  it("falls back to PostHog's cookie on a full page load, while that session is live", async () => {
    mocks.cookies.mockResolvedValue(posthogCookie({ idleMs: 60_000 }));
    await captureServerEvent({ distinctId: 'user_1', event: 'auth:sign-in' });

    // Idle past 30 minutes, or active but started over 24 hours ago: the session has ended.
    mocks.cookies.mockResolvedValue(posthogCookie({ idleMs: 31 * 60_000 }));
    await captureServerEvent({ distinctId: 'user_1', event: 'auth:sign-in' });
    mocks.cookies.mockResolvedValue(posthogCookie({ idleMs: 60_000, ageMs: 25 * 3600_000 }));
    await captureServerEvent({ distinctId: 'user_1', event: 'auth:sign-in' });

    expect(mocks.captureImmediate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ properties: { $session_id: 'session_cookie' } })
    );
    expect(mocks.captureImmediate).toHaveBeenNthCalledWith(2, expect.objectContaining({ properties: {} }));
    expect(mocks.captureImmediate).toHaveBeenNthCalledWith(3, expect.objectContaining({ properties: {} }));
  });

  it('takes a session id the caller read before the request was gone', async () => {
    mocks.headers.mockRejectedValue(new Error('headers() inside after()'));

    await captureServerEvent({ distinctId: 'user_1', event: 'onboarding:started', sessionId: 'session_2' });

    expect(mocks.captureImmediate).toHaveBeenCalledWith(
      expect.objectContaining({ properties: { $session_id: 'session_2' } })
    );
    expect(mocks.headers).not.toHaveBeenCalled();
  });

  it('sends the event without a session where there is no request to read', async () => {
    mocks.headers.mockRejectedValue(new Error('headers() inside after()'));

    await captureServerEvent({ distinctId: 'user_1', event: 'onboarding:started' });

    expect(mocks.captureImmediate).toHaveBeenCalledWith(expect.objectContaining({ properties: {} }));
  });
});
