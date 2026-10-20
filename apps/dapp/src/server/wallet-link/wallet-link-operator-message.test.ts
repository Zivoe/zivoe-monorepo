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
    email: 'ada@example.com',
    address: ADDRESS,
    nonce: NONCE,
    issuedAt: SIGNED_AT,
    expiresAt: EXPIRES_AT
  }),
  signature: null,
  signedAt: SIGNED_AT,
  whitelistRequestedAt: SIGNED_AT,
  whitelistObservedAt: null,
  removedAt: null,
  ...overrides
});

const TARGETS = [
  { chain: 'ethereum', chainId: 1, shareClassKey: 'zsmb', shareTokenAddress: ADDRESS },
  { chain: 'base', chainId: 8453, shareClassKey: 'zsmb', shareTokenAddress: ADDRESS }
] as const;
const membership = (verdicts: [MembershipVerdict, MembershipVerdict]): AddressMembership =>
  TARGETS.map((target, index) => ({ target, verdict: verdicts[index]! }));
const NOWHERE = membership(['not-member', 'not-member']);

describe('the operator message', () => {
  it('asks for a whitelist with who, which address and under which share class — escaped', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'whitelist_request',
      record: record(),
      email: 'ada<script>@example.com',
      isSmartAccount: false,
      membership: NOWHERE,
      noDecision: null,
      otherAccounts: []
    });

    expect(text.split('\n')).toEqual([
      '<b>🟢 Whitelist request</b>',
      '',
      '<b>User:</b> ada&lt;script&gt;@example.com',
      '<b>Address:</b> 0x8815...e9e6',
      '<code>0x881500000000000000000000000000000000e9e6</code>',
      '<b>Wallet:</b> WalletConnect · signed on Ethereum',
      '<b>Whitelist now:</b> a member on none of 2 chains'
    ]);
  });

  it('asks for a revoke with the link date, naming an unknown wallet and chain as such', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'revoke_request',
      record: record({
        status: 'removed',
        walletType: null,
        walletName: null,
        chainId: 999_999,
        removedAt: new Date()
      }),
      email: null,
      isSmartAccount: false,
      membership: NOWHERE,
      noDecision: null,
      otherAccounts: []
    });

    expect(text.split('\n')).toEqual([
      '<b>🔴 Revoke request</b>',
      '',
      '<b>Reason:</b> verification no longer approved',
      '<b>User:</b> unknown (profile gone)',
      '<b>Address:</b> 0x8815...e9e6',
      '<code>0x881500000000000000000000000000000000e9e6</code>',
      '<b>Wallet:</b> unknown · signed on 999999',
      '<b>Whitelist now:</b> a member on none of 2 chains',
      '<b>Also connected by:</b> no other account',
      '<b>Linked since:</b> 2026-10-01'
    ]);
  });

  it('says on a revoke which Decision ended the link and who else connected the address', () => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'revoke_request',
      record: record({ status: 'removed', removedAt: new Date() }),
      email: 'ada@example.com',
      isSmartAccount: false,
      membership: NOWHERE,
      noDecision: 'revoked',
      otherAccounts: [
        { email: 'bob@example.com', isVerified: true },
        { email: 'eve<b>@example.com', isVerified: false }
      ]
    });

    expect(text.split('\n')[2]).toBe('<b>Reason:</b> verification revoked');
    expect(text).toContain(
      '<b>Also connected by:</b> bob@example.com (verified), eve&lt;b&gt;@example.com (not verified)'
    );
  });

  it('names the first ten other accounts and counts the rest, so a shared address stays under Telegram’s limit', () => {
    const otherAccounts = Array.from({ length: 12 }, (_, index) => ({
      email: `user-${index}@example.com`,
      isVerified: false
    }));

    const text = formatWalletLinkOperatorMessage({
      kind: 'revoke_request',
      record: record({ status: 'removed', removedAt: new Date() }),
      email: 'ada@example.com',
      isSmartAccount: false,
      membership: NOWHERE,
      noDecision: 'declined',
      otherAccounts
    });

    const line = text.split('\n').find((candidate) => candidate.startsWith('<b>Also connected by:</b>'))!;
    expect(line).toContain('user-9@example.com (not verified), and 2 more');
    expect(line).not.toContain('user-10@example.com');
  });

  it.each([
    ['a member on 1 of 2 chains', membership(['member', 'not-member'])],
    ['a member on 1 of 2 chains, frozen on Base', membership(['member', 'frozen'])],
    ['a member on 2 of 2 chains', membership(['member', 'member'])],
    ['a member on 1 of 2 chains, could not be read on Base', membership(['member', 'unknown'])],
    ['could not be read', null]
  ] as const)('says where the address stands now: %s', (expected, current) => {
    const text = formatWalletLinkOperatorMessage({
      kind: 'revoke_request',
      record: record({ status: 'removed', removedAt: new Date() }),
      email: 'ada@example.com',
      isSmartAccount: false,
      membership: current,
      noDecision: 'revoked',
      otherAccounts: []
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
      noDecision: null,
      otherAccounts: []
    });

    expect(text.split('\n').slice(5, 7)).toEqual([
      '<b>Wallet:</b> Safe · signed on Base',
      '<b>Smart account:</b> control proven on Base only'
    ]);
  });

  it('posts to the channel it was wired with', async () => {
    const sendTelegramMessage = vi.fn(async () => ({}));

    await createTelegramWalletLinkMessenger({ sendTelegramMessage, chatId: 'chat-1' }).send({
      kind: 'whitelist_request',
      record: record(),
      email: 'ada@example.com',
      isSmartAccount: false,
      membership: NOWHERE,
      noDecision: null,
      otherAccounts: []
    });

    expect(sendTelegramMessage).toHaveBeenCalledWith({
      chatId: 'chat-1',
      text: expect.stringContaining('<b>🟢 Whitelist request</b>')
    });
  });
});
