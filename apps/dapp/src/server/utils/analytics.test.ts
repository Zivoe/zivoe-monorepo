import { beforeEach, describe, expect, it, vi } from 'vitest';

import { captureServerEvent } from './analytics';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  captureImmediate: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/env', () => ({ env: { NEXT_PUBLIC_ENV: 'production', NEXT_PUBLIC_CHAIN_ENV: 'testnet' } }));
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

  it('sends the event without a session where there is no request to read', async () => {
    mocks.headers.mockRejectedValue(new Error('headers() inside after()'));

    await captureServerEvent({ distinctId: 'user_1', event: 'onboarding:started' });

    expect(mocks.captureImmediate).toHaveBeenCalledWith(expect.objectContaining({ properties: {} }));
  });
});
