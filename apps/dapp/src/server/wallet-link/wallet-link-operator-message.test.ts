import { type Address } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { type WalletLinkRecord } from './wallet-link';
import { type AddressMembership, type MembershipVerdict } from './wallet-link-membership';
import { createTelegramWalletLinkMessenger, formatWalletLinkOperatorMessage } from './wallet-link-operator-message';
import { buildWalletLinkTypedData } from './wallet-link-typed-data';

// `escapeHtml` lives in @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const ADDRESS = '0x881500000000000000000000000000000000e9e6' as Address;
const SIGNED_AT = new Date('2026-10-01T09:30:00.000Z');
const EXPIRES_AT = new Date('2026-10-08T09:30:00.000Z');
const NONCE = `0x${'ab'.repeat(32)}` as const;

const record = (overrides: Partial<WalletLinkRecord> = {}): WalletLinkRecord => ({
  id: 'link_1',
  userId: 'user-1',
  address: ADDRESS,
  walletType: 'WalletConnect',
  walletName: null,
  chainId: 1,
  status: 'linked',
  nonce: NONCE,
  issuedAt: SIGNED_AT,
  expiresAt: EXPIRES_AT,
  typedData: buildWalletLinkTypedData({
    chainId: 1,
    userId: 'user_1',
    address: ADDRESS,
    nonce: NONCE,
    issuedAt: SIGNED_AT,
    expiresAt: EXPIRES_AT
  }),
  signature: null,
  signedAt: SIGNED_AT,
  whitelistRequestedAt: SIGNED_AT,
  whitelistObservedAt: null,
  opsRequest: 'whitelist',
  opsRequestVersion: 1,
  ...overrides
});

const TARGETS = [
  { chain: 'ethereum', chainId: 1, shareClassKey: 'zsmb', shareTokenAddress: ADDRESS },
  { chain: 'base', chainId: 8453, shareClassKey: 'zsmb', shareTokenAddress: ADDRESS }
] as const;
const membership = (
  verdicts: [MembershipVerdict, MembershipVerdict],
  frozenOn: Array<(typeof TARGETS)[number]['chain']> = []
): AddressMembership =>
  TARGETS.map((target, index) => ({ target, verdict: verdicts[index]!, frozen: frozenOn.includes(target.chain) }));
const NOWHERE = membership(['not-member', 'not-member']);

describe('the operator message', () => {
  it('asks for a whitelist with who, which address and where it stands — escaped', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'whitelist_request',
      record: record(),
      email: 'ada<script>@example.com',
      isSmartAccount: false,
      membership: NOWHERE,
      endedBy: null
    });

    expect(text.split('\n')).toEqual([
      '<b>🟢 Whitelist request #1</b>',
      '',
      '<b>Reason:</b> new link',
      '<b>User:</b> ada&lt;script&gt;@example.com',
      '<b>Address:</b> <code>0x881500000000000000000000000000000000e9e6</code>',
      '<b>Wallet:</b> WalletConnect · signed on Ethereum',
      '<b>Whitelist now:</b> a member on none of 2 chains'
    ]);
  });

  it('asks for a revoke with the link date, naming an unknown wallet and chain as such', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'revoke_request',
      record: record({
        walletType: null,
        walletName: null,
        chainId: 999_999,
        opsRequest: 'revoke',
        opsRequestVersion: 2
      }),
      email: null,
      isSmartAccount: false,
      membership: NOWHERE,
      endedBy: null
    });

    expect(text.split('\n')).toEqual([
      '<b>🔴 Revoke request #2</b>',
      '',
      '<b>Reason:</b> no longer approved when asked, approved again since; a member on no chain when sent, so nothing to freeze unless admitted since',
      '<b>Supersedes:</b> every lower-numbered request for this address; act on the highest number',
      '<b>User:</b> unknown (profile gone)',
      '<b>Address:</b> <code>0x881500000000000000000000000000000000e9e6</code>',
      '<b>Wallet:</b> unknown · signed on 999999',
      '<b>Whitelist now:</b> a member on none of 2 chains',
      '<b>Linked since:</b> 2026-10-01'
    ]);
  });

  it("says on a revoke what the owner's status is now", () => {
    const reasonFor = (endedBy: 'revoked' | 'pending_review' | 'in_progress') =>
      formatWalletLinkOperatorMessage({
        kind: 'revoke_request',
        record: record({ opsRequest: 'revoke', opsRequestVersion: 2 }),
        email: 'ada@example.com',
        isSmartAccount: false,
        membership: membership(['member', 'not-member']),
        endedBy
      }).split('\n')[2];

    expect(reasonFor('revoked')).toBe('<b>Reason:</b> verification revoked; freeze on every chain');
    expect(reasonFor('pending_review')).toBe('<b>Reason:</b> verification back under review; freeze on every chain');
    expect(reasonFor('in_progress')).toBe('<b>Reason:</b> verification no longer approved; freeze on every chain');
  });

  it('asks to freeze unless every chain read the address as no member', () => {
    const reasonWith = (read: AddressMembership | null) =>
      formatWalletLinkOperatorMessage({
        kind: 'revoke_request',
        record: record({ opsRequest: 'revoke', opsRequestVersion: 2 }),
        email: 'ada@example.com',
        isSmartAccount: false,
        membership: read,
        endedBy: 'declined'
      }).split('\n')[2];

    expect(reasonWith(NOWHERE)).toBe(
      '<b>Reason:</b> verification declined; a member on no chain when sent, so nothing to freeze unless admitted since'
    );
    expect(reasonWith(membership(['not-member', 'unknown']))).toBe(
      '<b>Reason:</b> verification declined; freeze on every chain'
    );
    expect(reasonWith(null)).toBe('<b>Reason:</b> verification declined; freeze on every chain');
  });

  it('asks to lift a freeze when the owner is approved again, with no new signature', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'whitelist_request',
      record: record({ opsRequestVersion: 3 }),
      email: 'ada@example.com',
      isSmartAccount: false,
      membership: membership(['member', 'member'], ['base']),
      endedBy: null
    });

    expect(text.split('\n').slice(0, 4)).toEqual([
      '<b>🟢 Whitelist request #3</b>',
      '',
      '<b>Reason:</b> approved again; unfreeze where frozen, whitelist where missing',
      '<b>Supersedes:</b> every lower-numbered request for this address; act on the highest number'
    ]);
  });

  it('flags a new link to an address already frozen, even where another chain did not answer', () => {
    const reasonWith = (read: AddressMembership) =>
      formatWalletLinkOperatorMessage({
        kind: 'whitelist_request',
        record: record(),
        email: 'ada@example.com',
        isSmartAccount: false,
        membership: read,
        endedBy: null
      }).split('\n')[2];
    const reason = '<b>Reason:</b> new link to an address already frozen; check why before unfreezing';

    expect(reasonWith(membership(['member', 'not-member'], ['ethereum']))).toBe(reason);
    expect(reasonWith(membership(['member', 'unknown'], ['ethereum']))).toBe(reason);
  });

  it('flags a new link to an address already whitelisted: someone else may be investing with it', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'whitelist_request',
      record: record(),
      email: 'ada@example.com',
      isSmartAccount: false,
      membership: membership(['member', 'member']),
      endedBy: null
    });

    expect(text.split('\n')[2]).toBe(
      '<b>Reason:</b> new link to an address already whitelisted; nothing to do unless this owner is unexpected'
    );
  });

  it.each([
    ['a member on 1 of 2 chains', membership(['member', 'not-member'])],
    // Frozen is said beside the count, never instead of it: ops must still revoke a frozen member.
    ['a member on 2 of 2 chains, frozen on Base', membership(['member', 'member'], ['base'])],
    ['a member on 1 of 2 chains, frozen on Base', membership(['member', 'not-member'], ['base'])],
    ['a member on 2 of 2 chains', membership(['member', 'member'])],
    ['a member on 1 of 2 chains, could not be read on Base', membership(['member', 'unknown'])],
    ['could not be read', null]
  ] as const)('says where the address stands now: %s', (expected, current) => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'revoke_request',
      record: record({ opsRequest: 'revoke', opsRequestVersion: 2 }),
      email: 'ada@example.com',
      isSmartAccount: false,
      membership: current,
      endedBy: 'revoked'
    });

    expect(text).toContain(`<b>Whitelist now:</b> ${expected}`);
  });

  it('tells ops when the address is a smart account, whose proof covers the signing chain only', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'whitelist_request',
      record: record({ walletType: 'safe', walletName: 'Safe', chainId: 8453 }),
      email: 'ada@example.com',
      isSmartAccount: true,
      membership: NOWHERE,
      endedBy: null
    });

    expect(text.split('\n').slice(5, 7)).toEqual([
      '<b>Wallet:</b> Safe · signed on Base',
      '<b>Smart account:</b> control proven on Base only'
    ]);
  });

  it('says when the kind of account could not be checked, rather than passing it off as a key', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'whitelist_request',
      record: record({ chainId: 8453 }),
      email: 'ada@example.com',
      isSmartAccount: null,
      membership: NOWHERE,
      endedBy: null
    });

    expect(text.split('\n')[6]).toBe(
      '<b>Smart account:</b> could not be checked; if it is one, control is proven on Base only'
    );
  });

  it('posts to the channel it was wired with', async () => {
    const sendTelegramMessage = vi.fn(async () => ({}));

    await createTelegramWalletLinkMessenger({ sendTelegramMessage, chatId: 'chat-1' }).send({
      kind: 'whitelist_request',
      record: record(),
      email: 'ada@example.com',
      isSmartAccount: false,
      membership: NOWHERE,
      endedBy: null
    });

    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: 'chat-1',
      text: expect.stringContaining('<b>🟢 Whitelist request #1</b>')
    });
  });
});
