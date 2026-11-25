import { describe, expect, it } from 'vitest';

import { invitationLinkPath, invitedEmailOf } from './return-paths';

describe("an invitation link's address", () => {
  it('rides in the fragment and reads back as sent, a plus-tag included', () => {
    const url = new URL(
      invitationLinkPath({ invitationId: '0600cf8f-f4a7-4b91-a9c8-ea55919f48e2', email: 'ann+zivoe@example.com' }),
      'https://app.zivoe.com'
    );

    expect(url.pathname).toBe('/invitations/0600cf8f-f4a7-4b91-a9c8-ea55919f48e2');
    expect(url.search).toBe('');
    expect(invitedEmailOf(url.hash)).toBe('ann+zivoe@example.com');
  });

  it('reads as none when the fragment holds no address', () => {
    expect(invitedEmailOf('')).toBeNull();
    expect(invitedEmailOf('#email=not-an-address')).toBeNull();
  });
});
