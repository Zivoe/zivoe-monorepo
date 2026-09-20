import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signOutAction } from './auth';

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), deleteCookie: vi.fn(), redirect: vi.fn() }));

vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ delete: mocks.deleteCookie })
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@/server/auth', () => ({ auth: { api: { signOut: mocks.signOut } } }));
// The module's toast import drags in the React runtime; the action only needs handlePromise.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('signOutAction', () => {
  it('clears the Lighthouse pass, so signing out of the dapp ends Lighthouse access at once', async () => {
    mocks.signOut.mockResolvedValue({ success: true });

    await signOutAction();

    expect(mocks.deleteCookie).toHaveBeenCalledWith(expect.objectContaining({ name: 'lighthouse-pass', path: '/' }));
    expect(mocks.redirect).toHaveBeenCalledWith('/sign-in');
  });

  it('keeps the pass when signing out fails, since the dapp session is still alive', async () => {
    mocks.signOut.mockRejectedValue(new Error('database down'));

    expect(await signOutAction()).toEqual({ error: 'Error signing out' });
    expect(mocks.deleteCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
