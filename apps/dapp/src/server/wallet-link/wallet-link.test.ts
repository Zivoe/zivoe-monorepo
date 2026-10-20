import { type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';

import { createManualClock } from '@/server/kyc/kyc-verification.fakes';

import { type WalletLink, createWalletLink } from './wallet-link';
import { type MembershipTarget } from './wallet-link-membership';
import { WALLET_LINK_STATEMENT, type WalletLinkTypedData, toSignableTypedData } from './wallet-link-typed-data';
import {
  createFakeChain,
  createFakeKyc,
  createFakeScreening,
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
  const fakeKyc = createFakeKyc();
  const fakeScreening = createFakeScreening();
  const fakeChain = createFakeChain({ targets: TARGETS });
  const memoryOutbox = createInMemoryWalletLinkOutbox();
  const memoryOperator = createInMemoryWalletLinkOperatorMessenger();
  const memoryEmails = createInMemoryWhitelistedEmailSender();

  const walletLink = createWalletLink({
    store: memoryStore.store,
    kyc: fakeKyc.kyc,
    screening: fakeScreening.screening,
    chain: fakeChain.chain,
    outbox: memoryOutbox.outbox,
    operatorMessages: memoryOperator.messenger,
    whitelistedEmails: memoryEmails.sender,
    clock: manualClock.clock
  });

  fakeKyc.set(ALICE, {});
  fakeKyc.set(BOB, {});
  memoryStore.accounts.set(ALICE, { email: 'alice@example.com', name: 'Alice' });
  memoryStore.accounts.set(BOB, { email: 'bob@example.com', name: null });

  return {
    walletLink,
    clock: manualClock,
    store: memoryStore,
    kyc: fakeKyc,
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
        account: 'alice@example.com',
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
    const { walletLink, kyc, store, screening } = setup();
    kyc.set(ALICE, view);

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
    const { walletLink, kyc } = setup();
    kyc.set(ALICE, { path: 'organization', status: 'manually_approved' });

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

  it('is refused for an address the user already linked, but never tells whose an address is', async () => {
    const { walletLink } = setup();
    await linkEoa(walletLink, ALICE);

    await expect(
      walletLink.issueChallenge({
        userId: ALICE,
        address: SIGNER,
        chainId: CHAIN_ID,
        walletType: null,
        walletName: null
      })
    ).resolves.toEqual({ ok: false, error: { code: 'already_linked' } });
    // Bob is issued a challenge like anyone else: what Alice asked for is
    // hers, and saying so would be an oracle for Zivoe's customer addresses.
    const bobs = await walletLink.issueChallenge({
      userId: BOB,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    expect(bobs.ok).toBe(true);
  });
});

describe('completing a link', () => {
  it('links an EOA: the row is linked, the wallet connection exists, ops is queued with the signature stamp', async () => {
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
      whitelistObservedAt: null
    });
    expect(linked.value.signature).toMatch(/^0x/);
    // The tracker never ran; the link write itself guaranteed the connection row.
    expect(store.connections.has(`${ALICE}:${SIGNER}`)).toBe(true);
    expect(outbox.jobs).toEqual([{ kind: 'whitelist_request', linkId: linked.value.id, at: T0 }]);
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
        membership: TARGETS.map((target) => ({ target, verdict: 'not-member' })),
        noDecision: null,
        otherAccounts: []
      }
    ]);
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
    const { walletLink, kyc } = setup();
    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    const signature = await sign(issued.ok ? issued.value.typedData : ({} as WalletLinkTypedData));
    kyc.set(ALICE, { status: 'revoked' });

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

  it('links one address for two accounts: each has its own request, and ops hears of both', async () => {
    const { walletLink, outbox } = setup();
    const alices = await linkEoa(walletLink, ALICE);
    const bobs = await linkEoa(walletLink, BOB);

    expect(alices.ok && alices.value.userId).toBe(ALICE);
    expect(bobs.ok && bobs.value.userId).toBe(BOB);
    await expect(walletLink.listLinks({ userId: ALICE })).resolves.toHaveLength(1);
    await expect(walletLink.listLinks({ userId: BOB })).resolves.toHaveLength(1);
    expect(outbox.jobs.map((job) => job.kind)).toEqual(['whitelist_request', 'whitelist_request']);
  });

  it('refuses a second challenge for an address the account linked meanwhile, and drops it', async () => {
    const { walletLink, store } = setup();
    const input = { userId: ALICE, address: SIGNER, chainId: CHAIN_ID, walletType: null, walletName: null };
    const first = await walletLink.issueChallenge(input);
    if (!first.ok) throw new Error('issue refused');
    await walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(first.value.typedData) });
    // A challenge issued in the same instant the first was completed: the pre-check could not see the link.
    vi.spyOn(store.store, 'getLinked').mockResolvedValueOnce(null);
    const second = await walletLink.issueChallenge(input);
    if (!second.ok) throw new Error('issue refused');

    await expect(
      walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(second.value.typedData) })
    ).resolves.toEqual({ ok: false, error: { code: 'already_linked' } });
    await expect(store.store.getPending({ userId: ALICE, address: SIGNER })).resolves.toBeNull();
    await expect(walletLink.listLinks({ userId: ALICE })).resolves.toHaveLength(1);
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

describe('reconcile', () => {
  it('marks a row whitelisted once every chain reports membership, and emails once', async () => {
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
      ended: 0,
      unchecked: 0,
      stuck: []
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

    // Seen whitelisted once, the row is out of the chain read: whatever ops
    // does to the membership afterwards, no second email and no report.
    chain.setMembership(SIGNER, ['member', 'not-member']);
    const again = await walletLink.reconcile({ now: new Date(now.getTime() + 4 * DAY) });
    expect(again).toMatchObject({ checked: 0, whitelisted: 0, stuck: [] });
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
    const stalled = { linkId: linked.value.id, address: SIGNER, memberOn: 1, total: 2 };
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

  it.each(['revoked', 'declined'] as const)(
    'ends the Linked addresses of an investor whose Decision became %s, and asks ops to revoke',
    async (status) => {
      const { walletLink, kyc, chain, outbox, operator, emails, clock } = setup();
      await linkEoa(walletLink);

      // "Not yet" is not a no: a review reopened ends nothing.
      kyc.set(ALICE, { status: 'pending_review' });
      expect((await walletLink.reconcile({ now: clock.clock.now() })).ended).toBe(0);

      chain.setMembership(SIGNER, 'member');
      kyc.set(ALICE, { status });
      const report = await walletLink.reconcile({ now: clock.clock.now() });

      // Neither announced as whitelisted nor left linked: the revoke is on its way.
      expect(report).toMatchObject({ ended: 1, whitelisted: 0, checked: 0 });
      await expect(walletLink.listLinks({ userId: ALICE })).resolves.toEqual([]);
      await expect(walletLink.deliverNotification({ job: outbox.jobs.at(-1)! })).resolves.toEqual({
        ok: true,
        value: 'sent'
      });
      // And the request says which Decision ended the link, and where the address stands now.
      expect(operator.sent).toMatchObject([
        {
          kind: 'revoke_request',
          noDecision: status,
          otherAccounts: [],
          membership: TARGETS.map((target) => ({ target, verdict: 'member' }))
        }
      ]);
      expect(emails.sent).toEqual([]);
    }
  );

  it("treats two accounts' requests for one address apart: both are emailed, and a no ends only its own", async () => {
    const { walletLink, kyc, chain, outbox, operator, clock } = setup();
    await linkEoa(walletLink, ALICE);
    await linkEoa(walletLink, BOB);
    chain.setMembership(SIGNER, 'member');

    const first = await walletLink.reconcile({ now: clock.clock.now() });
    expect(first).toMatchObject({ checked: 2, whitelisted: 2 });
    expect(outbox.jobs.filter((job) => job.kind === 'whitelisted_email')).toHaveLength(2);

    kyc.set(ALICE, { status: 'revoked' });
    const second = await walletLink.reconcile({ now: clock.clock.now() });
    expect(second).toMatchObject({ ended: 1 });
    await expect(walletLink.listLinks({ userId: ALICE })).resolves.toEqual([]);
    await expect(walletLink.listLinks({ userId: BOB })).resolves.toHaveLength(1);
    // Bob holds his own request, and so connected the address: the Revoke request names him.
    await walletLink.deliverNotification({ job: outbox.jobs.at(-1)! });
    expect(operator.sent.at(-1)).toMatchObject({
      kind: 'revoke_request',
      otherAccounts: [{ email: 'bob@example.com', isVerified: true }]
    });
  });

  it('names on a Revoke request every other account that connected the address, and whether it is verified', async () => {
    const { walletLink, kyc, outbox, operator, store, clock } = setup();
    await linkEoa(walletLink, ALICE);
    // Bob only connected the address in the dapp; he never asked for a whitelist, and is not verified.
    store.connections.add(`${BOB}:${SIGNER}`);
    kyc.set(BOB, { status: 'in_progress' });

    kyc.set(ALICE, { status: 'revoked' });
    await walletLink.reconcile({ now: clock.clock.now() });
    await walletLink.deliverNotification({ job: outbox.jobs.at(-1)! });

    expect(operator.sent.at(-1)).toMatchObject({
      kind: 'revoke_request',
      otherAccounts: [{ email: 'bob@example.com', isVerified: false }]
    });
  });

  it('still asks ops to revoke when the chains cannot be read, saying so instead of where the address stands', async () => {
    const { walletLink, kyc, chain, outbox, operator, clock } = setup();
    await linkEoa(walletLink);
    kyc.set(ALICE, { status: 'revoked' });
    await walletLink.reconcile({ now: clock.clock.now() });

    chain.failMembershipReads(new Error('every RPC down'));
    await expect(walletLink.deliverNotification({ job: outbox.jobs.at(-1)! })).resolves.toEqual({
      ok: true,
      value: 'sent'
    });

    expect(operator.sent.at(-1)).toMatchObject({ kind: 'revoke_request', membership: null });
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
  it('asks for a retry while the row has not caught up, and skips a job the row moved past', async () => {
    const { walletLink } = setup();
    const issued = await walletLink.issueChallenge({
      userId: ALICE,
      address: SIGNER,
      chainId: CHAIN_ID,
      walletType: null,
      walletName: null
    });
    if (!issued.ok) throw new Error('issue refused');

    // Before any link: the whitelist request is early.
    await expect(
      walletLink.deliverNotification({ job: { kind: 'whitelist_request', linkId: issued.value.linkId, at: T0 } })
    ).resolves.toEqual({ ok: false, error: { code: 'not_caught_up' } });

    await walletLink.completeLink({ userId: ALICE, address: SIGNER, signature: await sign(issued.value.typedData) });
    // A job with a stamp the row does not carry (an earlier click whose persist failed) is stale.
    await expect(
      walletLink.deliverNotification({
        job: { kind: 'whitelist_request', linkId: issued.value.linkId, at: new Date(T0.getTime() - 1) }
      })
    ).resolves.toEqual({ ok: true, value: 'skipped' });
    // The revoke and the email are early until their stamps land.
    await expect(
      walletLink.deliverNotification({ job: { kind: 'revoke_request', linkId: issued.value.linkId, at: T0 } })
    ).resolves.toEqual({ ok: false, error: { code: 'not_caught_up' } });
    await expect(
      walletLink.deliverNotification({ job: { kind: 'whitelisted_email', linkId: issued.value.linkId, at: T0 } })
    ).resolves.toEqual({ ok: false, error: { code: 'not_caught_up' } });
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

  it('skips the whitelist request and the email for an address removed meanwhile; the revoke still goes', async () => {
    const { walletLink, kyc, outbox, operator, emails, chain, clock } = setup();
    await linkEoa(walletLink);
    // The sweep saw it whitelisted and queued the email; then the Decision became a no and the next pass removed it.
    chain.setMembership(SIGNER, 'member');
    await walletLink.reconcile({ now: clock.clock.now() });
    kyc.set(ALICE, { status: 'revoked' });
    await walletLink.reconcile({ now: clock.clock.now() });
    const [whitelistRequest, whitelistedEmail, revokeRequest] = outbox.jobs;

    // Asking ops to whitelist it now would undo the revoke that follows; the email would announce a lie.
    await expect(walletLink.deliverNotification({ job: whitelistRequest! })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
    await expect(walletLink.deliverNotification({ job: whitelistedEmail! })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
    await expect(walletLink.deliverNotification({ job: revokeRequest! })).resolves.toEqual({ ok: true, value: 'sent' });
    expect(operator.sent.map((message) => message.kind)).toEqual(['revoke_request']);
    expect(emails.sent).toEqual([]);
  });

  it('skips a Whitelist request whose investor stopped being a yes before it was delivered', async () => {
    const { walletLink, kyc, outbox, operator } = setup();
    await linkEoa(walletLink);
    kyc.set(ALICE, { status: 'revoked' });

    await expect(walletLink.deliverNotification({ job: outbox.jobs[0]! })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
    expect(operator.sent).toEqual([]);
  });

  it('skips a Revoke request whose investor is a yes again before it was delivered', async () => {
    const { walletLink, kyc, outbox, operator, clock } = setup();
    await linkEoa(walletLink);
    kyc.set(ALICE, { status: 'revoked' });
    await walletLink.reconcile({ now: clock.clock.now() });
    const revokeRequest = outbox.jobs.find((job) => job.kind === 'revoke_request')!;

    // Re-approved and linked again while the Revoke request waited in the
    // queue: delivering it now would ask ops to undo the Whitelist request.
    kyc.set(ALICE, { status: 'approved' });
    await linkEoa(walletLink);
    await expect(walletLink.deliverNotification({ job: revokeRequest })).resolves.toEqual({
      ok: true,
      value: 'skipped'
    });
    expect(operator.sent).toEqual([]);
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
