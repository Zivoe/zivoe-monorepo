import { type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';

import { createManualClock } from '@/server/verification/verification.fakes';

import { ok } from '@/lib/result';

import { type WalletLink, createWalletLink } from './wallet-link';
import { type MembershipTarget } from './wallet-link-membership';
import { WALLET_LINK_STATEMENT, type WalletLinkTypedData, toSignableTypedData } from './wallet-link-typed-data';
import {
  createFakeChain,
  createFakeScreening,
  createFakeVerification,
  createInMemoryWalletLinkOperatorMessenger,
  createInMemoryWalletLinkOutbox,
  createInMemoryWalletLinkStore,
  createInMemoryWhitelistedEmailSender
} from './wallet-link.fakes';

const ALICE = '7b6f9a1e-0c1d-4e6f-9a2b-3c4d5e6f7a8b';
const BOB = '0f1e2d3c-4b5a-4968-8776-655443322110';
const T0 = new Date('2026-10-03T10:00:00.000Z');
const DAY = 24 * 60 * 60_000;
const HOUR = 60 * 60_000;
const CHAIN_ID = 11155111;

// A throwaway key: the EOA whose signatures the fake chain recovers.
const signer = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const SIGNER = signer.address.toLowerCase() as Address;
const stranger = privateKeyToAccount('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba');

const TARGETS: Array<MembershipTarget> = [
  {
    chain: 'sepolia',
    chainId: 11155111,
    shareClassKey: 'zsmb',
    shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6'
  },
  {
    chain: 'base-sepolia',
    chainId: 84532,
    shareClassKey: 'zsmb',
    shareTokenAddress: '0x19Dad928674E78665fE172A56Eb721589d7964A6'
  }
];

function setup() {
  const manualClock = createManualClock(T0);
  const memoryStore = createInMemoryWalletLinkStore();
  const fakeVerification = createFakeVerification();
  const fakeScreening = createFakeScreening();
  const fakeChain = createFakeChain({ targets: TARGETS });
  const memoryOutbox = createInMemoryWalletLinkOutbox();
  const memoryOperator = createInMemoryWalletLinkOperatorMessenger();
  const memoryEmails = createInMemoryWhitelistedEmailSender();

  const walletLink = createWalletLink({
    store: memoryStore.store,
    verification: fakeVerification.verification,
    screening: fakeScreening.screening,
    chain: fakeChain.chain,
    outbox: memoryOutbox.outbox,
    operatorMessages: memoryOperator.messenger,
    whitelistedEmails: memoryEmails.sender,
    clock: manualClock.clock
  });

  fakeVerification.set(ALICE, {});
  fakeVerification.set(BOB, {});
  memoryStore.accounts.set(ALICE, { email: 'alice@example.com', name: 'Alice' });
  memoryStore.accounts.set(BOB, { email: 'bob@example.com', name: null });

  return {
    walletLink,
    clock: manualClock,
    store: memoryStore,
    verification: fakeVerification,
    screening: fakeScreening,
    chain: fakeChain,
    outbox: memoryOutbox,
    operator: memoryOperator,
    emails: memoryEmails
  };
}

const sign = (typedData: WalletLinkTypedData, account = signer) =>
  account.signTypedData(toSignableTypedData(typedData));

/** Issue, sign with the EOA and complete — the happy path as one call. */
async function linkEoa(walletLink: WalletLink, userId = ALICE, address: Address = SIGNER) {
  const issued = await walletLink.issueChallenge({
    userId,
    address,
    chainId: CHAIN_ID,
    walletType: 'metamask',
    walletName: 'MetaMask'
  });
  if (!issued.ok) throw new Error(`issue refused: ${issued.error.code}`);
  const signature = await sign(issued.value.typedData);
  return walletLink.completeLink({ userId, address, signature });
}

describe('the challenge', () => {
  it('names the account, the wallet and the statement, lowercases the address and expires in a day', async () => {
    const { walletLink } = setup();

    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: signer.address,
      chainId: CHAIN_ID,
      walletType: 'metamask',
      walletName: 'MetaMask'
    });

    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.value.typedData).toMatchObject({
      domain: { name: 'Zivoe Verification', version: '1', chainId: CHAIN_ID },
      primaryType: 'WalletLink',
      message: {
        statement: WALLET_LINK_STATEMENT,
        account: ALICE,
        wallet: SIGNER,
        issuedAt: Math.floor(T0.getTime() / 1000),
        expiresAt: Math.floor(T0.getTime() / 1000) + 24 * 60 * 60
      }
    });
    expect(issued.value.typedData.message.nonce).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('is identical on a second issue inside the window and fresh after it expires', async () => {
    const { walletLink, clock } = setup();
    const input = { userId: ALICE, address: SIGNER, chainId: CHAIN_ID, walletType: 'metamask', walletName: 'MetaMask' };

    const first = await walletLink.issueChallenge(input);
    clock.advance(23 * HOUR);
    const second = await walletLink.issueChallenge(input);
    expect(second).toEqual(first);

    clock.advance(2 * HOUR);
    const third = await walletLink.issueChallenge(input);
    expect(third.ok && first.ok && third.value.typedData.message.nonce).not.toBe(
      first.ok && first.value.typedData.message.nonce
    );
    // The same row, re-issued: the pending challenge for the pair is upserted in place.
    expect(third.ok && first.ok && third.value.linkId).toBe(first.ok && first.value.linkId);
  });

  it('re-issues for a different chain, since the domain names the chain the wallet is on', async () => {
    const { walletLink } = setup();

    const onSepolia = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: 11155111,
      walletType: null,
      walletName: null
    });
    const onBase = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: 84532,
      walletType: null,
      walletName: null
    });

    expect(onBase.ok && onBase.value.typedData.domain.chainId).toBe(84532);
    expect(onBase.ok && onSepolia.ok && onBase.value.typedData.message.nonce).not.toBe(
      onSepolia.ok && onSepolia.value.typedData.message.nonce
    );
  });

  it('keeps the payload but names the wallet that holds the address now on a re-issue', async () => {
    const { walletLink, store } = setup();

    const first = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: 'metamask',
      walletName: 'MetaMask'
    });
    const second = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: 'walletconnect',
      walletName: 'WalletConnect'
    });

    expect(second).toEqual(first);
    expect((await store.store.getPending({ userId: ALICE, address: SIGNER }))?.walletType).toBe('walletconnect');
  });

  it.each([
    ['a submitted verification', { status: 'submitted' } as const],
    ['a declined verification', { status: 'declined' } as const],
    ['a revoked verification', { status: 'revoked' } as const],
    ['an organization the team has not approved', { path: 'organization', status: 'not_started' } as const]
  ])('is refused without a yes Decision (%s)', async (_label, view) => {
    const { walletLink, verification, store, screening } = setup();
    verification.set(ALICE, view);

    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });

    expect(issued).toEqual({ ok: false, error: { code: 'not_approved' } });
    expect(store.records.size).toBe(0);
    expect(screening.calls).toHaveLength(0);
  });

  it('is issued for an organization the team approved: its yes is a Decision like any other', async () => {
    const { walletLink, verification } = setup();
    verification.set(ALICE, { path: 'organization', status: 'manually_approved' });

    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });

    expect(issued.ok).toBe(true);
  });

  it('is refused for a flagged address and leaves no row behind', async () => {
    const { walletLink, screening, store } = setup();
    screening.flagged.add(SIGNER);

    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });

    expect(issued).toEqual({ ok: false, error: { code: 'flagged' } });
    expect(store.records.size).toBe(0);
  });

  it('is refused for an address with an owner, before any screen: the owner is told it is theirs, anyone else only that it is taken', async () => {
    const { walletLink, screening, store } = setup();
    await linkEoa(walletLink, ALICE);
    const screens = screening.calls.length;
    const input = { address: SIGNER, chainId: CHAIN_ID, walletType: null, walletName: null };

    await expect(walletLink.issueChallenge({ userId: ALICE, ...input })).resolves.toEqual({
      ok: false,
      error: { code: 'already_linked' }
    });
    await expect(walletLink.issueChallenge({ userId: BOB, ...input })).resolves.toEqual({
      ok: false,
      error: { code: 'linked_elsewhere' }
    });
    expect(screening.calls).toHaveLength(screens);
    await expect(store.store.getPending({ userId: BOB, address: SIGNER })).resolves.toBeNull();
  });
});

describe('ownership', () => {
  it('answers mine, elsewhere or none — to a yes Decision only', async () => {
    const { walletLink, verification } = setup();
    await linkEoa(walletLink, ALICE);
    const other = '0x2222222222222222222222222222222222222222';

    await expect(walletLink.getOwnership({ userId: ALICE, address: signer.address })).resolves.toEqual(ok('mine'));
    await expect(walletLink.getOwnership({ userId: BOB, address: SIGNER })).resolves.toEqual(ok('elsewhere'));
    await expect(walletLink.getOwnership({ userId: BOB, address: other })).resolves.toEqual(ok('none'));

    verification.set(BOB, { status: 'declined' });
    await expect(walletLink.getOwnership({ userId: BOB, address: SIGNER })).resolves.toEqual({
      ok: false,
      error: { code: 'not_approved' }
    });
  });
});

describe('completing a link', () => {
  it('links an EOA: the row is linked and asks ops to whitelist, the wallet connection exists, ops is queued with version 1', async () => {
    const { walletLink, store, outbox, operator } = setup();

    const linked = await linkEoa(walletLink);

    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.value).toMatchObject({
      userId: ALICE,
      address: SIGNER,
      walletType: 'metamask',
      walletName: 'MetaMask',
      chainId: CHAIN_ID,
      status: 'linked',
      signedAt: T0,
      whitelistRequestedAt: T0,
      whitelistObservedAt: null,
      opsRequest: 'whitelist',
      opsRequestVersion: 1
    });
    expect(linked.value.signature).toMatch(/^0x/);
    // The tracker never ran; the link write itself guaranteed the connection row.
    expect(store.connections.has(`${ALICE}:${SIGNER}`)).toBe(true);
    expect(outbox.jobs).toEqual([{ kind: 'whitelist_request', linkId: linked.value.id, version: 1 }]);
    await expect(walletLink.listLinks({ userId: ALICE })).resolves.toHaveLength(1);

    // The queued job, delivered: the operator line carries the record and the email read at delivery.
    const delivered = await walletLink.deliverNotification({ job: outbox.jobs[0]! });
    expect(delivered).toEqual({ ok: true, value: 'sent' });
    expect(operator.sent).toEqual([
      {
        kind: 'whitelist_request',
        record: expect.objectContaining({ id: linked.value.id }),
        email: 'alice@example.com',
        isSmartAccount: false,
        // Read at delivery too: a member nowhere yet, which is what the request is for.
        membership: TARGETS.map((target) => ({ target, verdict: 'not-member', frozen: false })),
        endedBy: null,
        // Screened again at delivery: what ops checks before admitting it.
        screening: 'clear'
      }
    ]);
  });

  it('links when Chainalysis cannot answer, and the Whitelist request tells ops to screen the address', async () => {
    const { walletLink, screening, outbox, operator } = setup();
    screening.failScreens(new Error('chainalysis down'));

    const linked = await linkEoa(walletLink);

    expect(linked).toMatchObject({ ok: true, value: { status: 'linked', opsRequest: 'whitelist' } });
    // Issue, completion and delivery each asked.
    await walletLink.deliverNotification({ job: outbox.jobs[0]! });
    expect(screening.calls).toHaveLength(3);
    expect(operator.sent).toMatchObject([{ kind: 'whitelist_request', screening: 'unscreened' }]);
  });

  it('tells ops of a flag Chainalysis answers at delivery for a link it could not screen', async () => {
    const { walletLink, screening, outbox, operator } = setup();
    screening.failScreens(new Error('chainalysis down'));
    await linkEoa(walletLink);

    screening.failScreens(null);
    screening.flagged.add(SIGNER);
    await walletLink.deliverNotification({ job: outbox.jobs[0]! });

    expect(operator.sent).toMatchObject([{ kind: 'whitelist_request', screening: 'flagged' }]);
  });

  it('accepts a checksummed address and stores it lowercase', async () => {
    const { walletLink } = setup();

    const linked = await linkEoa(walletLink, ALICE, signer.address);

    expect(linked.ok && linked.value.address).toBe(SIGNER);
  });

  it('refuses without a challenge, and after the challenge expired', async () => {
    const { walletLink, clock } = setup();

    await expect(walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: '0x00' })).resolves.toEqual({
      ok: false,
      error: { code: 'no_challenge' }
    });

    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    const signature = await sign(issued.ok ? issued.value.typedData : ({} as WalletLinkTypedData));
    clock.advance(DAY);
    await expect(walletLink.completeLink({ userId: ALICE, address: SIGNER, signature })).resolves.toEqual({
      ok: false,
      error: { code: 'expired' }
    });
  });

  it('refuses a signature by another key, and one over a different nonce', async () => {
    const { walletLink, store } = setup();
    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    if (!issued.ok) throw new Error('issue refused');

    const byStranger = await sign(issued.value.typedData, stranger);
    await expect(walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: byStranger })).resolves.toEqual({
      ok: false,
      error: { code: 'bad_signature' }
    });

    const otherNonce = {
      ...issued.value.typedData,
      message: { ...issued.value.typedData.message, nonce: `0x${'ab'.repeat(32)}` as const }
    };
    await expect(
      walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(otherNonce) })
    ).resolves.toEqual({ ok: false, error: { code: 'bad_signature' } });
    // The challenge is still there for a correct signature.
    expect([...store.records.values()].filter((record) => record.status === 'pending')).toHaveLength(1);
  });

  it('refuses a stored signature after the record stopped being a yes Decision', async () => {
    const { walletLink, verification } = setup();
    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    const signature = await sign(issued.ok ? issued.value.typedData : ({} as WalletLinkTypedData));
    verification.set(ALICE, { status: 'revoked' });

    await expect(walletLink.completeLink({ userId: ALICE, address: SIGNER, signature })).resolves.toEqual({
      ok: false,
      error: { code: 'not_approved' }
    });
  });

  it('refuses an address flagged between issue and signature, and drops the challenge', async () => {
    const { walletLink, screening, store, outbox } = setup();
    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    const signature = await sign(issued.ok ? issued.value.typedData : ({} as WalletLinkTypedData));
    screening.flagged.add(SIGNER);

    await expect(walletLink.completeLink({ userId: ALICE, address: SIGNER, signature })).resolves.toEqual({
      ok: false,
      error: { code: 'flagged' }
    });
    expect(store.records.size).toBe(0);
    expect(outbox.jobs).toHaveLength(0);
  });

  it('refuses a challenge issued before another account linked the address, and drops it before anything is queued', async () => {
    const { walletLink, store, outbox } = setup();
    const bobs = await walletLink.issueChallenge({
      userId: BOB,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    if (!bobs.ok) throw new Error('issue refused');
    await linkEoa(walletLink, ALICE);

    await expect(
      walletLink.completeLink({ userId: BOB, address: SIGNER, signature: await sign(bobs.value.typedData) })
    ).resolves.toEqual({ ok: false, error: { code: 'linked_elsewhere' } });
    await expect(store.store.getPending({ userId: BOB, address: SIGNER })).resolves.toBeNull();
    expect(outbox.jobs.map((job) => job.linkId)).toEqual([(await store.store.getOwner({ address: SIGNER }))?.id]);
    await expect(walletLink.listLinks({ userId: BOB })).resolves.toEqual([]);
  });

  it('lets the database refuse a second owner that got past the check, and skips the job queued for it', async () => {
    const { walletLink, store, outbox, operator } = setup();
    const input = { address: SIGNER, chainId: CHAIN_ID, walletType: null, walletName: null };
    const alices = await walletLink.issueChallenge({ userId: ALICE, ...input });
    const bobs = await walletLink.issueChallenge({ userId: BOB, ...input });
    if (!alices.ok || !bobs.ok) throw new Error('issue refused');
    await walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(alices.value.typedData) });

    // Both completions in the same instant: Bob's check ran before Alice's write landed.
    const getOwner = store.store.getOwner.bind(store.store);
    vi.spyOn(store.store, 'getOwner').mockResolvedValueOnce(null).mockImplementation(getOwner);
    await expect(
      walletLink.completeLink({ userId: BOB, address: SIGNER, signature: await sign(bobs.value.typedData) })
    ).resolves.toEqual({ ok: false, error: { code: 'linked_elsewhere' } });

    // Bob's job was queued before the refusal; his challenge is gone, so it skips.
    const bobsJob = outbox.jobs.find((job) => job.linkId === bobs.value.linkId)!;
    await expect(walletLink.deliverNotification({ job: bobsJob })).resolves.toEqual({ ok: true, value: 'skipped' });
    expect(operator.sent).toEqual([]);
    expect([...store.records.values()].filter((record) => record.status === 'linked')).toHaveLength(1);
  });

  it('refuses a second challenge of the same account for an address it linked meanwhile', async () => {
    const { walletLink, store } = setup();
    const input = { userId: ALICE, address: SIGNER, chainId: CHAIN_ID, walletType: null, walletName: null };
    const first = await walletLink.issueChallenge(input);
    if (!first.ok) throw new Error('issue refused');
    await walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(first.value.typedData) });
    // A challenge issued in the same instant the first was completed: the pre-check could not see the link.
    vi.spyOn(store.store, 'getOwner').mockResolvedValueOnce(null);
    const second = await walletLink.issueChallenge(input);
    if (!second.ok) throw new Error('issue refused');

    await expect(
      walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(second.value.typedData) })
    ).resolves.toEqual({ ok: false, error: { code: 'already_linked' } });
    await expect(store.store.getPending({ userId: ALICE, address: SIGNER })).resolves.toBeNull();
    await expect(walletLink.listLinks({ userId: ALICE })).resolves.toHaveLength(1);
  });

  it('answers already linked when another tab completed the same challenge while this one was verifying', async () => {
    const { walletLink, chain } = setup();
    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    if (!issued.ok) throw new Error('issue refused');
    const signature = await sign(issued.value.typedData);

    // The other tab completes the same challenge while this one's signature is out for verification.
    const verify = chain.chain.verifyTypedData.bind(chain.chain);
    vi.spyOn(chain.chain, 'verifyTypedData').mockImplementationOnce(async (args) => {
      const valid = await verify(args);
      await walletLink.completeLink({ userId: ALICE, address: SIGNER, signature });
      return valid;
    });

    await expect(walletLink.completeLink({ userId: ALICE, address: SIGNER, signature })).resolves.toEqual({
      ok: false,
      error: { code: 'already_linked' }
    });
    await expect(walletLink.listLinks({ userId: ALICE })).resolves.toHaveLength(1);

    // A third tab, after both: no challenge left, and the answer is still that it is linked.
    await expect(walletLink.completeLink({ userId: ALICE, address: SIGNER, signature })).resolves.toEqual({
      ok: false,
      error: { code: 'already_linked' }
    });
  });

  it('refuses when the challenge was re-issued while its signature was being verified', async () => {
    const { walletLink, chain, store } = setup();
    const input = { userId: ALICE, address: SIGNER, chainId: CHAIN_ID, walletType: 'metamask', walletName: 'MetaMask' };
    const issued = await walletLink.issueChallenge(input);
    if (!issued.ok) throw new Error('issue refused');

    // A second tab asks for a challenge on another chain while the first one's signature is out for verification.
    const verify = chain.chain.verifyTypedData.bind(chain.chain);
    vi.spyOn(chain.chain, 'verifyTypedData').mockImplementationOnce(async (args) => {
      const valid = await verify(args);
      await walletLink.issueChallenge({ ...input, chainId: 84532 });
      return valid;
    });

    await expect(
      walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(issued.value.typedData) })
    ).resolves.toEqual({ ok: false, error: { code: 'no_challenge' } });
    // The row is still the second challenge, unsigned: the proof on record is never one nobody verified.
    await expect(store.store.getPending({ userId: ALICE, address: SIGNER })).resolves.toMatchObject({
      id: issued.value.linkId,
      chainId: 84532,
      signature: null
    });
  });

  it('accepts a smart wallet through the chain: the signature the contract validates, nothing else', async () => {
    const { walletLink, chain, outbox, operator } = setup();
    const safe = '0x1111111111111111111111111111111111111111';
    chain.smartWallets.set(safe, '0xdeadbeef');
    await walletLink.issueChallenge({
      userId: ALICE,
      address: safe,
      chainId: CHAIN_ID,
      walletType: 'safe',
      walletName: 'Safe'
    });

    await expect(walletLink.completeLink({ userId: ALICE, address: safe, signature: '0xbadbad' })).resolves.toEqual({
      ok: false,
      error: { code: 'bad_signature' }
    });
    const linked = await walletLink.completeLink({ userId: ALICE, address: safe, signature: '0xdeadbeef' });
    expect(linked.ok && linked.value.status).toBe('linked');
    // Verified on the chain the challenge was issued for.
    expect(chain.verifications.at(-1)).toEqual({ chainId: CHAIN_ID, address: safe });

    // Ops is told: a contract's proof covers the signing chain only.
    await walletLink.deliverNotification({ job: outbox.jobs[0]! });
    expect(operator.sent).toEqual([expect.objectContaining({ kind: 'whitelist_request', isSmartAccount: true })]);
  });

  it('does not persist when the Outbox refuses, so the next click re-enqueues', async () => {
    const { walletLink, outbox, store } = setup();
    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    const signature = await sign(issued.ok ? issued.value.typedData : ({} as WalletLinkTypedData));
    outbox.failNextCall(new Error('queue down'));

    await expect(walletLink.completeLink({ userId: ALICE, address: SIGNER, signature })).rejects.toThrow('queue down');
    expect([...store.records.values()][0]?.status).toBe('pending');

    const retried = await walletLink.completeLink({ userId: ALICE, address: SIGNER, signature });
    expect(retried.ok && retried.value.status).toBe('linked');
    expect(outbox.jobs).toHaveLength(1);
  });
});

/** Links Alice's address, has the sweep ask ops to revoke it (the Decision became `status`), and returns the row id. */
async function linkThenRevoke(
  s: ReturnType<typeof setup>,
  status: 'revoked' | 'declined' | 'pending_review' = 'revoked'
) {
  const linked = await linkEoa(s.walletLink);
  if (!linked.ok) throw new Error('link refused');
  s.verification.set(ALICE, { status });
  await s.walletLink.reconcile({ now: s.clock.clock.now() });
  return linked.value.id;
}

describe('reconcile', () => {
  it('marks a row whitelisted once every chain admits it, emails once, and reports it if it lapses', async () => {
    const { walletLink, chain, outbox, emails, clock, store } = setup();
    const linked = await linkEoa(walletLink);
    if (!linked.ok) throw new Error('link refused');
    chain.setMembership(SIGNER, 'member');
    clock.advance(60_000);
    const now = clock.clock.now();

    const report = await walletLink.reconcile({ now });

    expect(report).toEqual({
      checked: 1,
      whitelisted: 1,
      revoked: 0,
      restored: 0,
      unchecked: 0,
      unscreened: 0,
      stuck: [],
      lapsed: [],
      stillAdmitted: [],
      flagged: []
    });
    expect(store.records.get(linked.value.id)?.whitelistObservedAt).toEqual(now);
    expect(outbox.jobs.at(-1)).toEqual({ kind: 'whitelisted_email', linkId: linked.value.id, at: now });

    await expect(walletLink.deliverNotification({ job: outbox.jobs.at(-1)! })).resolves.toEqual({
      ok: true,
      value: 'sent'
    });
    expect(emails.sent).toEqual([
      { to: 'alice@example.com', name: 'Alice', address: SIGNER, linkId: linked.value.id, whitelistObservedAt: now }
    ]);

    // Frozen on one chain since, by mistake or a chain added: the digest lists it, every day, and nobody is emailed again.
    chain.setFrozen(SIGNER, [false, true]);
    const again = await walletLink.reconcile({ now: new Date(now.getTime() + 4 * DAY) });
    expect(again).toMatchObject({
      checked: 1,
      whitelisted: 0,
      stuck: [],
      lapsed: [{ linkId: linked.value.id, address: SIGNER, admittedOn: 1, total: 2 }]
    });
    expect(outbox.jobs.filter((job) => job.kind === 'whitelisted_email')).toHaveLength(1);
  });

  it('never whitelists on a failed read, and reports a partial membership on the reminder days only', async () => {
    const { walletLink, chain, clock, store } = setup();
    const linked = await linkEoa(walletLink);
    if (!linked.ok) throw new Error('link refused');

    chain.setMembership(SIGNER, ['member', 'unknown']);
    const early = await walletLink.reconcile({ now: clock.clock.now() });
    expect(early).toMatchObject({ checked: 1, whitelisted: 0, unchecked: 1, stuck: [] });
    expect(store.records.get(linked.value.id)?.whitelistObservedAt).toBeNull();

    chain.setMembership(SIGNER, ['member', 'not-member']);
    expect((await walletLink.reconcile({ now: clock.clock.now() })).stuck).toEqual([]);

    // Days 3, 7, 14 and 30 after the request, then never again — wherever
    // inside its hour a run happens to start.
    const stalled = { linkId: linked.value.id, address: SIGNER, admittedOn: 1, total: 2 };
    const reportedOn = async (day: number, offsetMs: number) =>
      (await walletLink.reconcile({ now: new Date(T0.getTime() + day * DAY + offsetMs) })).stuck;

    expect(await reportedOn(2, 30_000)).toEqual([]);
    expect(await reportedOn(3, 1)).toEqual([{ ...stalled, daysWaiting: 3, isLastReminder: false }]);
    expect(await reportedOn(4, 30_000)).toEqual([]);
    expect(await reportedOn(7, 59_000)).toMatchObject([{ daysWaiting: 7, isLastReminder: false }]);
    expect(await reportedOn(14, 0)).toMatchObject([{ daysWaiting: 14 }]);
    expect(await reportedOn(30, 5_000)).toEqual([{ ...stalled, daysWaiting: 30, isLastReminder: true }]);
    expect(await reportedOn(31, 5_000)).toEqual([]);
    expect(await reportedOn(60, 5_000)).toEqual([]);
  });

  it.each(['revoked', 'declined', 'pending_review'] as const)(
    'keeps the Linked address of an owner whose yes became %s, and asks ops to revoke it once',
    async (status) => {
      const s = setup();
      const { walletLink, verification, chain, outbox, operator, emails, clock } = s;
      await linkEoa(walletLink);

      // An operator's approval is a yes like Persona's, and asks nothing new.
      verification.set(ALICE, { status: 'manually_approved' });
      expect((await walletLink.reconcile({ now: clock.clock.now() })).revoked).toBe(0);

      chain.setMembership(SIGNER, 'member');
      verification.set(ALICE, { status });
      const report = await walletLink.reconcile({ now: clock.clock.now() });

      // Not announced as whitelisted, still linked for good, and the revoke is on its way.
      expect(report).toMatchObject({ revoked: 1, whitelisted: 0 });
      await expect(walletLink.listLinks({ userId: ALICE })).resolves.toMatchObject([
        { opsRequest: 'revoke', opsRequestVersion: 2 }
      ]);
      const revokeRequest = outbox.jobs.at(-1)!;
      expect(revokeRequest).toMatchObject({ kind: 'revoke_request', version: 2 });
      await expect(walletLink.deliverNotification({ job: revokeRequest })).resolves.toEqual({
        ok: true,
        value: 'sent'
      });
      // The request says why, and where the address stands now.
      expect(operator.sent).toMatchObject([
        {
          kind: 'revoke_request',
          endedBy: status,
          membership: TARGETS.map((target) => ({ target, verdict: 'member' }))
        }
      ]);
      expect(emails.sent).toEqual([]);

      // Asked once: the next pass has nothing new to ask, and lists the revoke as not done yet.
      const next = await walletLink.reconcile({ now: clock.clock.now() });
      expect(next).toMatchObject({ revoked: 0, stillAdmitted: [{ address: SIGNER, admittedOn: 2, total: 2 }] });
      expect(outbox.jobs.filter((job) => job.kind === 'revoke_request')).toHaveLength(1);

      // Frozen everywhere: the revoke is done, and the digest stops.
      chain.setFrozen(SIGNER, true);
      expect((await walletLink.reconcile({ now: clock.clock.now() })).stillAdmitted).toEqual([]);
    }
  );

  it('asks ops to restore an owner approved again, with no new signature, and emails again once restored', async () => {
    const s = setup();
    const { walletLink, verification, chain, outbox, operator, emails, clock, screening, store } = s;
    const id = await linkThenRevoke(s);
    chain.setMembership(SIGNER, 'member');
    chain.setFrozen(SIGNER, true);
    const screens = screening.calls.length;

    verification.set(ALICE, { status: 'approved' });
    clock.advance(HOUR);
    const restoredAt = clock.clock.now();
    const report = await walletLink.reconcile({ now: restoredAt });

    // Screened again first, as a new link is; then the Whitelist request, a new cycle.
    expect(screening.calls.length).toBe(screens + 1);
    expect(report).toMatchObject({ restored: 1, revoked: 0, whitelisted: 0 });
    expect(store.records.get(id)).toMatchObject({
      opsRequest: 'whitelist',
      opsRequestVersion: 3,
      whitelistRequestedAt: restoredAt,
      whitelistObservedAt: null
    });
    const restore = outbox.jobs.at(-1)!;
    expect(restore).toEqual({ kind: 'whitelist_request', linkId: id, version: 3 });
    await expect(walletLink.deliverNotification({ job: restore })).resolves.toEqual({ ok: true, value: 'sent' });
    expect(operator.sent.at(-1)).toMatchObject({
      kind: 'whitelist_request',
      record: expect.objectContaining({ opsRequestVersion: 3 })
    });

    // Ops unfreezes: seen whitelisted for the new cycle, and the investor hears so.
    chain.setFrozen(SIGNER, false);
    const after = await walletLink.reconcile({ now: clock.clock.now() });
    expect(after).toMatchObject({ whitelisted: 1 });
    await walletLink.deliverNotification({ job: outbox.jobs.at(-1)! });
    expect(emails.sent).toHaveLength(1);
  });

  it('keeps a revoked address frozen when Chainalysis flags it on approval again', async () => {
    const s = setup();
    const { walletLink, verification, outbox, clock, screening, store } = s;
    const id = await linkThenRevoke(s);
    const jobs = outbox.jobs.length;
    verification.set(ALICE, { status: 'approved' });
    screening.flagged.add(SIGNER);

    expect(await walletLink.reconcile({ now: clock.clock.now() })).toMatchObject({
      restored: 0,
      unscreened: 0,
      flagged: [{ linkId: id, address: SIGNER }]
    });
    expect(outbox.jobs).toHaveLength(jobs);
    expect(store.records.get(id)).toMatchObject({ opsRequest: 'revoke', opsRequestVersion: 2 });
  });

  it('restores an owner approved again when Chainalysis cannot answer, and tells ops to screen the address', async () => {
    const s = setup();
    const { walletLink, verification, outbox, operator, clock, screening, store } = s;
    const id = await linkThenRevoke(s);
    verification.set(ALICE, { status: 'approved' });
    screening.failScreens(new Error('chainalysis down'));

    expect(await walletLink.reconcile({ now: clock.clock.now() })).toMatchObject({ restored: 1, unscreened: 1 });
    expect(store.records.get(id)).toMatchObject({ opsRequest: 'whitelist', opsRequestVersion: 3 });
    await walletLink.deliverNotification({ job: outbox.jobs.at(-1)! });
    expect(operator.sent.at(-1)).toMatchObject({ kind: 'whitelist_request', screening: 'unscreened' });
  });

  it('asks for a revoke before it waits on the screen of a restore', async () => {
    const s = setup();
    const { walletLink, verification, outbox, clock, screening } = s;
    await linkThenRevoke(s);
    clock.advance(HOUR);
    const issued = await walletLink.issueChallenge({
      userId: BOB,
      address: stranger.address,
      chainId: CHAIN_ID,
      walletType: 'metamask',
      walletName: 'MetaMask'
    });
    if (!issued.ok) throw new Error('issue refused');
    const linked = await walletLink.completeLink({
      userId: BOB,
      address: stranger.address,
      signature: await sign(issued.value.typedData, stranger)
    });
    if (!linked.ok) throw new Error('link refused');
    verification.set(ALICE, { status: 'approved' });
    verification.set(BOB, { status: 'revoked' });

    // Chainalysis takes the call and does not answer; Alice signed first.
    vi.spyOn(screening.screening, 'assess').mockReturnValue(new Promise(() => undefined));
    void walletLink.reconcile({ now: clock.clock.now() });

    await vi.waitFor(() =>
      expect(outbox.jobs.at(-1)).toMatchObject({ kind: 'revoke_request', linkId: linked.value.id })
    );
  });

  it('screens every restore together, so a slow Chainalysis costs one wait however many are waiting', async () => {
    const s = setup();
    const { walletLink, verification, clock, screening, store } = s;
    const id = await linkThenRevoke(s);
    const { id: _id, ...row } = store.records.get(id)!;
    const other = await store.store.putPending({
      ...row,
      userId: BOB,
      address: stranger.address.toLowerCase() as Address,
      status: 'pending'
    });
    const written = await store.store.link({
      id: other.id,
      nonce: other.nonce,
      signature: row.signature!,
      signedAt: clock.clock.now()
    });
    if (written.outcome !== 'linked') throw new Error('link refused');
    await store.store.setOpsRequest({
      id: other.id,
      from: { opsRequest: 'whitelist', version: 1 },
      to: 'revoke',
      at: clock.clock.now()
    });
    verification.set(ALICE, { status: 'approved' });
    verification.set(BOB, { status: 'approved' });

    let answer = (_risk: 'clear') => undefined as void;
    const assess = vi.spyOn(screening.screening, 'assess').mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );
    const pass = walletLink.reconcile({ now: clock.clock.now() });

    await vi.waitFor(() => expect(assess).toHaveBeenCalledTimes(2));
    answer('clear');
    expect(await pass).toMatchObject({ restored: 2 });
  });

  it('lists a revoke a chain still admits when another chain did not answer, and claims nothing from the unread one', async () => {
    const s = setup();
    const { walletLink, chain, clock } = s;
    await linkThenRevoke(s);

    chain.setMembership(SIGNER, ['member', 'unknown']);
    expect(await walletLink.reconcile({ now: clock.clock.now() })).toMatchObject({
      unchecked: 1,
      stillAdmitted: [{ address: SIGNER, admittedOn: 1, total: 2 }]
    });

    chain.setMembership(SIGNER, ['not-member', 'unknown']);
    expect(await walletLink.reconcile({ now: clock.clock.now() })).toMatchObject({ unchecked: 1, stillAdmitted: [] });
  });

  it('asks again next pass when the row could not be moved after its job was queued', async () => {
    const { walletLink, verification, outbox, clock, store } = setup();
    await linkEoa(walletLink);
    verification.set(ALICE, { status: 'revoked' });
    vi.spyOn(store.store, 'setOpsRequest').mockRejectedValueOnce(new Error('db down'));

    await expect(walletLink.reconcile({ now: clock.clock.now() })).rejects.toThrow('db down');
    // The job queued for version 2 waits for a row that never reached it; the next pass queues it again.
    expect(await walletLink.reconcile({ now: clock.clock.now() })).toMatchObject({ revoked: 1 });
    expect(outbox.jobs.filter((job) => job.kind === 'revoke_request')).toEqual([
      expect.objectContaining({ version: 2 }),
      expect.objectContaining({ version: 2 })
    ]);
  });

  it('drops expired challenges, which nothing can act on any more', async () => {
    const { walletLink, clock, store } = setup();
    await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    clock.advance(23 * HOUR);
    await walletLink.reconcile({ now: clock.clock.now() });
    await expect(store.store.getPending({ userId: ALICE, address: SIGNER })).resolves.not.toBeNull();

    clock.advance(2 * HOUR);
    await walletLink.reconcile({ now: clock.clock.now() });
    await expect(store.store.getPending({ userId: ALICE, address: SIGNER })).resolves.toBeNull();
  });
});

describe('deliverNotification', () => {
  it('retries a job the row has not reached, and skips one it moved past', async () => {
    const s = setup();
    const { walletLink } = s;
    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    if (!issued.ok) throw new Error('issue refused');
    const linkId = issued.value.linkId;

    // Before any link: the whitelist request is early.
    await expect(
      walletLink.deliverNotification({ job: { kind: 'whitelist_request', linkId, version: 1 } })
    ).resolves.toEqual({ ok: false, error: { code: 'not_caught_up' } });

    await walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(issued.value.typedData) });
    // The revoke the sweep is about to write, and the email before its stamp lands: early.
    await expect(
      walletLink.deliverNotification({ job: { kind: 'revoke_request', linkId, version: 2 } })
    ).resolves.toEqual({ ok: false, error: { code: 'not_caught_up' } });
    await expect(
      walletLink.deliverNotification({ job: { kind: 'whitelisted_email', linkId, at: T0 } })
    ).resolves.toEqual({ ok: false, error: { code: 'not_caught_up' } });

    // The row asked to revoke since: the Whitelist request it outlived is skipped, and so is a stale email.
    s.verification.set(ALICE, { status: 'declined' });
    await walletLink.reconcile({ now: s.clock.clock.now() });
    await expect(
      walletLink.deliverNotification({ job: { kind: 'whitelist_request', linkId, version: 1 } })
    ).resolves.toEqual({ ok: true, value: 'skipped' });
  });

  it("is the caller's retry when the channel refuses", async () => {
    const { walletLink, outbox, operator } = setup();
    await linkEoa(walletLink);
    operator.failNextCall(new Error('telegram down'));

    await expect(walletLink.deliverNotification({ job: outbox.jobs[0]! })).resolves.toMatchObject({
      ok: false,
      error: { code: 'send_failed' }
    });
  });

  it('skips the email for an address asked to revoke meanwhile', async () => {
    const { walletLink, verification, outbox, emails, chain, clock } = setup();
    await linkEoa(walletLink);
    chain.setMembership(SIGNER, 'member');
    await walletLink.reconcile({ now: clock.clock.now() });
    const whitelistedEmail = outbox.jobs.find((job) => job.kind === 'whitelisted_email')!;
    verification.set(ALICE, { status: 'revoked' });
    await walletLink.reconcile({ now: clock.clock.now() });

    await expect(walletLink.deliverNotification({ job: whitelistedEmail })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
    expect(emails.sent).toEqual([]);
  });

  it('turns a Whitelist request whose owner stopped being a yes into a revoke, so an approval again restores anew', async () => {
    const { walletLink, verification, outbox, operator, store, clock } = setup();
    const linked = await linkEoa(walletLink);
    if (!linked.ok) throw new Error('link refused');
    verification.set(ALICE, { status: 'revoked' });

    await expect(walletLink.deliverNotification({ job: outbox.jobs[0]! })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
    expect(operator.sent).toEqual([]);
    // Moved at delivery, as the sweep would have: nothing waits on a sweep seeing the no.
    expect(store.records.get(linked.value.id)).toMatchObject({ opsRequest: 'revoke', opsRequestVersion: 2 });
    expect(outbox.jobs.at(-1)).toEqual({ kind: 'revoke_request', linkId: linked.value.id, version: 2 });

    // A yes again before any sweep saw the no: the next pass still asks to restore.
    verification.set(ALICE, { status: 'approved' });
    expect(await walletLink.reconcile({ now: clock.clock.now() })).toMatchObject({ restored: 1 });
    expect(outbox.jobs.at(-1)).toEqual({ kind: 'whitelist_request', linkId: linked.value.id, version: 3 });
  });

  it('drops a request a later one overtook while it read the chain, so the older never lands last', async () => {
    const { walletLink, verification, chain, outbox, operator, clock } = setup();
    await linkEoa(walletLink);
    await walletLink.deliverNotification({ job: outbox.jobs.at(-1)! });
    verification.set(ALICE, { status: 'declined' });
    await walletLink.reconcile({ now: clock.clock.now() });
    const revoke = outbox.jobs.at(-1)!;

    // The revoke's delivery is held up on the chain; meanwhile the owner is approved again and the restore is sent.
    let release: () => void = () => undefined;
    const probe = chain.chain.isSmartAccount.bind(chain.chain);
    vi.spyOn(chain.chain, 'isSmartAccount').mockImplementationOnce(async (input) => {
      await new Promise<void>((resolve) => (release = resolve));
      return probe(input);
    });
    const slow = walletLink.deliverNotification({ job: revoke });
    verification.set(ALICE, { status: 'approved' });
    await walletLink.reconcile({ now: clock.clock.now() });
    await walletLink.deliverNotification({ job: outbox.jobs.at(-1)! });
    release();

    await expect(slow).resolves.toEqual({ ok: true, value: 'skipped' });
    expect(operator.sent.map(({ kind, record }) => [kind, record.opsRequestVersion])).toEqual([
      ['whitelist_request', 1],
      ['whitelist_request', 3]
    ]);
  });

  it('tells ops of a new link to an address already admitted everywhere: it has an owner now', async () => {
    const { walletLink, chain, outbox, operator } = setup();
    chain.setMembership(SIGNER, 'member');
    await linkEoa(walletLink);

    await expect(walletLink.deliverNotification({ job: outbox.jobs[0]! })).resolves.toEqual({
      ok: true,
      value: 'sent'
    });
    expect(operator.sent).toMatchObject([{ kind: 'whitelist_request' }]);
  });

  it('tells ops of every change whatever the chain shows, so the latest request cancels an earlier one not yet done', async () => {
    const { walletLink, verification, chain, outbox, operator, clock } = setup();
    // Linked, and its Whitelist request is in the channel; ops has not acted.
    await linkEoa(walletLink);
    await walletLink.deliverNotification({ job: outbox.jobs.at(-1)! });

    // Declined before ops acted: admitted nowhere, but the revoke still goes, or ops would whitelist it.
    verification.set(ALICE, { status: 'declined' });
    await walletLink.reconcile({ now: clock.clock.now() });
    await expect(walletLink.deliverNotification({ job: outbox.jobs.at(-1)! })).resolves.toEqual({
      ok: true,
      value: 'sent'
    });

    // Approved again before ops froze it: still admitted, but the restore still goes, or ops would freeze it.
    chain.setMembership(SIGNER, 'member');
    verification.set(ALICE, { status: 'approved' });
    await walletLink.reconcile({ now: clock.clock.now() });
    const restore = [...outbox.jobs].reverse().find((job) => job.kind === 'whitelist_request')!;
    await expect(walletLink.deliverNotification({ job: restore })).resolves.toEqual({
      ok: true,
      value: 'sent'
    });

    expect(operator.sent.map((message) => message.kind)).toEqual([
      'whitelist_request',
      'revoke_request',
      'whitelist_request'
    ]);

    // The chains cannot be read: the request goes, told the state is unknown.
    verification.set(ALICE, { status: 'revoked' });
    await walletLink.reconcile({ now: clock.clock.now() });
    chain.failMembershipReads(new Error('every RPC down'));
    await walletLink.deliverNotification({ job: outbox.jobs.at(-1)! });
    expect(operator.sent.at(-1)).toMatchObject({ kind: 'revoke_request', membership: null });
  });

  it("skips a Revoke request the owner's approval again moved past, and sends one it has not", async () => {
    const s = setup();
    const { walletLink, verification, chain, outbox, operator, clock } = s;
    chain.setMembership(SIGNER, 'member');
    await linkThenRevoke(s);
    const revokeRequest = outbox.jobs.at(-1)!;

    // Approved again before delivery, not yet swept: the row still asks to revoke, so the revoke goes.
    verification.set(ALICE, { status: 'approved' });
    await expect(walletLink.deliverNotification({ job: revokeRequest })).resolves.toEqual({ ok: true, value: 'sent' });
    expect(operator.sent).toMatchObject([{ kind: 'revoke_request', endedBy: null }]);

    // Swept: the row asks to restore, and the revoke a retry would repeat is skipped.
    await walletLink.reconcile({ now: clock.clock.now() });
    await expect(walletLink.deliverNotification({ job: revokeRequest })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
  });

  it('has nobody to tell when the row is gone', async () => {
    const { walletLink, outbox, store } = setup();
    await linkEoa(walletLink);
    store.records.clear();

    await expect(walletLink.deliverNotification({ job: outbox.jobs[0]! })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
  });
});
