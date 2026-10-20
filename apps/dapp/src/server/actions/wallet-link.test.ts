import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeWalletLink, issueWalletLinkChallenge, listWalletLinks } from './wallet-link';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isKycEnabled: vi.fn(),
  limit: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  issueChallenge: vi.fn(),
  completeLink: vi.fn(),
  listLinks: vi.fn()
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException, captureMessage: mocks.captureMessage }));
vi.mock('@/server/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('@/server/kyc/kyc-flag', () => ({ isKycEnabled: mocks.isKycEnabled }));
vi.mock('@/server/clients/redis', () => ({ redis: {} }));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    class {
      limit = mocks.limit;
    },
    { fixedWindow: () => ({}) }
  )
}));
vi.mock('@/server/wallet-link', () => ({
  walletLink: {
    issueChallenge: mocks.issueChallenge,
    completeLink: mocks.completeLink,
    listLinks: mocks.listLinks
  }
}));

const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const SEPOLIA = 11155111;
const LINK_ID = '77ce3fa7-9c2d-404f-8f90-3c8d562dbcd8';
const record = {
  id: LINK_ID,
  userId: 'user_1',
  address: ADDRESS.toLowerCase(),
  walletType: 'metamask',
  walletName: 'MetaMask',
  chainId: SEPOLIA,
  status: 'linked',
  signedAt: new Date('2026-10-04T10:00:00Z'),
  issuedAt: new Date('2026-10-04T09:59:00Z'),
  whitelistObservedAt: null
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: 'user_1', email: 'ada@example.com' } });
  mocks.isKycEnabled.mockResolvedValue(true);
  mocks.limit.mockResolvedValue({ success: true });
  mocks.issueChallenge.mockResolvedValue({ ok: true, value: { linkId: LINK_ID, typedData: {} } });
  mocks.completeLink.mockResolvedValue({ ok: true, value: record });
});

describe('the gate every action shares', () => {
  it.each([
    ['no session', () => mocks.getSession.mockResolvedValue(null), 'unauthorized'],
    ['the kyc flag off', () => mocks.isKycEnabled.mockResolvedValue(false), 'unauthorized'],
    ['the rate limit spent', () => mocks.limit.mockResolvedValue({ success: false }), 'rate_limited'],
    // Upstash's timeout answer is a success with a reason; unmetered is not an option.
    [
      'the limiter timing out',
      () => mocks.limit.mockResolvedValue({ success: true, reason: 'timeout' }),
      'rate_limited'
    ]
  ] as const)('refuses with %s and never reaches the module', async (_label, arrange, code) => {
    arrange();

    expect(
      await issueWalletLinkChallenge({ address: ADDRESS, chainId: SEPOLIA, walletType: null, walletName: null })
    ).toEqual({
      ok: false,
      error: { code }
    });
    expect(mocks.issueChallenge).not.toHaveBeenCalled();
  });

  it('answers a module that throws as failed, and captures it', async () => {
    mocks.issueChallenge.mockRejectedValue(new Error('database down'));

    expect(
      await issueWalletLinkChallenge({ address: ADDRESS, chainId: SEPOLIA, walletType: null, walletName: null })
    ).toEqual({
      ok: false,
      error: { code: 'failed' }
    });
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });
});

describe('issueWalletLinkChallenge', () => {
  it('hands the module the address, the chain and the wallet type', async () => {
    const result = await issueWalletLinkChallenge({
      address: ADDRESS,
      chainId: SEPOLIA,
      walletType: 'metamask',
      walletName: 'MetaMask'
    });

    expect(result).toEqual({ ok: true, value: { linkId: LINK_ID, typedData: {} } });
    expect(mocks.issueChallenge).toHaveBeenCalledWith({
      userId: 'user_1',
      address: ADDRESS,
      chainId: SEPOLIA,
      walletType: 'metamask',
      walletName: 'MetaMask'
    });
  });

  it.each([
    ['a chain this deployment does not serve', { chainId: 1 }],
    ['a malformed address', { address: '0x1234' }],
    ['an overlong wallet type', { walletType: 'x'.repeat(65) }],
    ['a wallet name with a line break', { walletName: 'MetaMask\nUser: someone@else.com' }]
  ])('refuses %s before the gate', async (_label, change) => {
    expect(
      await issueWalletLinkChallenge({
        address: ADDRESS,
        chainId: SEPOLIA,
        walletType: null,
        walletName: null,
        ...change
      })
    ).toEqual({ ok: false, error: { code: 'invalid_input' } });
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
});

describe('completeWalletLink', () => {
  it('maps the linked record to the page row', async () => {
    const result = await completeWalletLink({ address: ADDRESS, signature: '0xabcd' });

    expect(result).toEqual({
      ok: true,
      value: {
        id: LINK_ID,
        address: record.address,
        signedAt: record.signedAt,
        wasWhitelisted: false
      }
    });
    expect(mocks.completeLink).toHaveBeenCalledWith({ userId: 'user_1', address: ADDRESS, signature: '0xabcd' });
  });

  it.each([
    ['a signature that is not hex', '0xzz'],
    ['a signature past the ERC-6492 size', `0x${'ab'.repeat(10_001)}`]
  ])('refuses %s before the gate', async (_label, signature) => {
    expect(await completeWalletLink({ address: ADDRESS, signature })).toEqual({
      ok: false,
      error: { code: 'invalid_input' }
    });
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it('notes a signature that did not verify, and passes the refusal through', async () => {
    mocks.completeLink.mockResolvedValue({ ok: false, error: { code: 'bad_signature' } });

    expect(await completeWalletLink({ address: ADDRESS, signature: '0xabcd' })).toEqual({
      ok: false,
      error: { code: 'bad_signature' }
    });
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      'Wallet link refused: signature did not verify',
      expect.objectContaining({ level: 'warning', extra: { userId: 'user_1', address: ADDRESS } })
    );
  });
});

describe('listWalletLinks', () => {
  it('answers the session’s Linked addresses as the page shows them, without spending the limiter', async () => {
    mocks.listLinks.mockResolvedValue([record]);

    expect(await listWalletLinks()).toEqual({
      ok: true,
      value: [
        {
          id: LINK_ID,
          address: ADDRESS.toLowerCase(),
          signedAt: record.signedAt,
          wasWhitelisted: false
        }
      ]
    });
    expect(mocks.listLinks).toHaveBeenCalledWith({ userId: 'user_1' });
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it('refuses without a session or with the flag off, and answers a thrown read as failed', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    expect(await listWalletLinks()).toEqual({ ok: false, error: { code: 'unauthorized' } });

    mocks.isKycEnabled.mockResolvedValueOnce(false);
    expect(await listWalletLinks()).toEqual({ ok: false, error: { code: 'unauthorized' } });

    mocks.listLinks.mockRejectedValue(new Error('db down'));
    expect(await listWalletLinks()).toEqual({ ok: false, error: { code: 'failed' } });
    expect(mocks.captureException).toHaveBeenCalled();
  });
});
