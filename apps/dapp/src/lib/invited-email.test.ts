// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NEXT = '%2Finvitations%2F0600cf8f-f4a7-4b91-a9c8-ea55919f48e2';

// A fresh module per test: `readInvitedEmail` keeps what it read for the page's life.
const load = async () => {
  vi.resetModules();
  return import('./invited-email');
};

beforeEach(() => window.sessionStorage.clear());

describe("an invitation link's address on the way in", () => {
  it('leaves the URL on sign-in and is read there once, keeping the router state', async () => {
    window.history.replaceState({ router: 1 }, '', `/sign-in?next=${NEXT}#email=ann%2Bzivoe%40example.com`);
    const { readInvitedEmail, takeInvitedEmailFromUrl } = await load();

    takeInvitedEmailFromUrl();

    expect(window.location.href).toBe(`http://localhost:3000/sign-in?next=${NEXT}`);
    expect(window.history.state).toEqual({ router: 1 });
    expect(readInvitedEmail()).toBe('ann+zivoe@example.com');
    expect(window.sessionStorage.length).toBe(0);
    // A remount on the same page reads the same.
    expect(readInvitedEmail()).toBe('ann+zivoe@example.com');
  });

  it('starts each page load clean, so an address an earlier load kept is never read', async () => {
    window.sessionStorage.setItem('invited-email', 'earlier@example.com');
    window.history.replaceState(null, '', `/sign-in?next=${NEXT}`);
    const { readInvitedEmail, takeInvitedEmailFromUrl } = await load();

    takeInvitedEmailFromUrl();

    expect(readInvitedEmail()).toBeNull();
  });

  it.each(['/sign-in#email=ann%40example.com', `/sign-in?next=${NEXT}&next=${NEXT}#email=ann%40example.com`])(
    'is kept on sign-in only when it returns to one invitation: %s',
    async (url) => {
      window.history.replaceState(null, '', url);
      const { readInvitedEmail, takeInvitedEmailFromUrl } = await load();

      takeInvitedEmailFromUrl();

      expect(window.location.hash).toBe('');
      expect(readInvitedEmail()).toBeNull();
    }
  );

  it('leaves the URL anywhere else without being kept', async () => {
    window.history.replaceState(null, '', '/invitations/x#email=ann%40example.com');
    const { readInvitedEmail, takeInvitedEmailFromUrl } = await load();

    takeInvitedEmailFromUrl();

    expect(window.location.hash).toBe('');
    expect(readInvitedEmail()).toBeNull();
  });
});
