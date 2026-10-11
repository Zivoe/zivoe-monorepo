import { beforeEach, describe, expect, it, vi } from 'vitest';

import { captureServerEvent } from './analytics';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  captureImmediate: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_VERCEL_ENV: 'production', NEXT_PUBLIC_CHAIN_ENV: 'testnet' } }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('../clients/posthog', () => ({ posthog: { captureImmediate: mocks.captureImmediate } }));

beforeEach(() => vi.clearAllMocks());

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
