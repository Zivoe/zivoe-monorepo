// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PostHogIdentify } from './posthog';

const mocks = vi.hoisted(() => ({
  session: { data: null as { user: { id: string; email: string } } | null, isPending: true },
  userState: 'anonymous',
  identify: vi.fn(),
  reset: vi.fn()
}));

vi.mock('@/lib/auth-client', () => ({ useSession: () => mocks.session }));
vi.mock('posthog-js', () => ({
  default: { identify: mocks.identify, reset: mocks.reset, get_property: () => mocks.userState }
}));

const USER = { id: 'user_1', email: 'alex@zivoe.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = { data: null, isPending: true };
  mocks.userState = 'anonymous';
});

describe('PostHogIdentify', () => {
  it('waits for the session instead of resetting while it loads, then identifies once', () => {
    mocks.userState = 'identified';
    const { rerender } = render(<PostHogIdentify />);

    mocks.session = { data: { user: USER }, isPending: false };
    rerender(<PostHogIdentify />);

    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.identify).toHaveBeenCalledTimes(1);
    expect(mocks.identify).toHaveBeenCalledWith('user_1', { email: 'alex@zivoe.com' });
  });

  it('resets a browser still identified once the session turns out to be gone', () => {
    mocks.userState = 'identified';
    mocks.session = { data: null, isPending: false };

    render(<PostHogIdentify />);

    expect(mocks.reset).toHaveBeenCalledTimes(1);
  });

  it('keeps an anonymous visitor, so their history from the landing site survives', () => {
    mocks.session = { data: null, isPending: false };

    render(<PostHogIdentify />);

    expect(mocks.reset).not.toHaveBeenCalled();
    expect(mocks.identify).not.toHaveBeenCalled();
  });
});
