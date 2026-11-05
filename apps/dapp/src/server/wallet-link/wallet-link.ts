import 'server-only';

import { randomBytes } from 'node:crypto';
import { type Address, type Hex } from 'viem';

import { type VerificationStatus } from '@zivoe/database/kyc';
import { type WalletLinkOpsRequest, type WalletLinkStatus } from '@zivoe/database/wallet-link';

import { type DeliveryError, type DeliveryOutcome, type Verification } from '@/server/verification/verification';
import { isYesDecision } from '@/server/verification/verification-status';

import { type Result, err, ok } from '@/lib/result';

import { type AddressMembership, summarizeMembership } from './wallet-link-membership';
import { type WalletLinkTypedData, buildWalletLinkTypedData } from './wallet-link-typed-data';

// ---------------------------------------------------------------------------
// Wallet link — one account's signed proof that it controls one address,
// which makes it the address's owner for good, and the whitelist that follows
// the owner's Decision: a yes asks ops to whitelist, anything else to revoke
// (a freeze), a yes again to restore — never a new signature. One module, six
// operations, over injected ports: the store, the Decision (the Verification
// module), Chainalysis, the chain (signature verification and whitelist
// membership), the Outbox and the two channels. Production wires Postgres /
// viem / QStash / Telegram / Resend; tests wire the in-memory adapters in
// wallet-link.fakes.ts. The signed message lives in wallet-link-typed-data.ts
// and the membership vocabulary in wallet-link-membership.ts so the client
// shares both without this file.
// ---------------------------------------------------------------------------

/**
 * One Wallet link challenge and what became of it. `address` is lowercase. A
 * `linked` row is the address's one owner — no other account can link it,
 * and nothing ends it.
 */
export type WalletLinkRecord = {
  id: string;
  userId: string;
  address: Address;
  walletType: string | null;
  /** The wallet's display name at link time, from the client like `walletType`: shown, never trusted. */
  walletName: string | null;
  /** The chain the message was signed on; the one EIP-1271 verification asks. */
  chainId: number;
  status: WalletLinkStatus;
  nonce: Hex;
  issuedAt: Date;
  expiresAt: Date;
  /** The exact payload handed to the wallet, kept for audit; `completeLink` verifies against this, never a client copy. */
  typedData: WalletLinkTypedData;
  signature: Hex | null;
  signedAt: Date | null;
  /** When the latest Whitelist request was queued for ops: the link, or a yes again since. */
  whitelistRequestedAt: Date | null;
  /** When the reconcile first saw the address admitted everywhere since that request — a record, not the truth; the chain is. */
  whitelistObservedAt: Date | null;
  /** What ops was last asked for a Linked address; null on a challenge. */
  opsRequest: WalletLinkOpsRequest | null;
  /** Bumped by every change of `opsRequest`; the job that announces the change carries it. */
  opsRequestVersion: number;
};

/** Store port — the app database. Rejects on infrastructure failure. */
export type WalletLinkStore = {
  get(input: { id: string }): Promise<WalletLinkRecord | null>;
  getPending(input: { userId: string; address: Address }): Promise<WalletLinkRecord | null>;
  /** The address's `linked` row, whichever account owns it. */
  getOwner(input: { address: Address }): Promise<WalletLinkRecord | null>;
  /** Writes a pending challenge, replacing the user's existing pending one for the address. */
  putPending(record: Omit<WalletLinkRecord, 'id'>): Promise<WalletLinkRecord>;
  deletePending(input: { userId: string; address: Address }): Promise<void>;
  /**
   * In one transaction: ensures `wallet_connection` holds (user, address) —
   * a no-op when the tracker already recorded it — and flips the pending row
   * to `linked` with its Whitelist request (version 1). `address_taken` when
   * the unique index refuses (some account, this one included, linked the
   * address meanwhile); `not_pending` when the row is no longer the pending
   * challenge `nonce` names — linked, gone, or re-issued (a re-issue keeps
   * the row and replaces what it asks to sign).
   */
  link(input: {
    id: string;
    nonce: Hex;
    signature: Hex;
    signedAt: Date;
  }): Promise<{ outcome: 'linked'; record: WalletLinkRecord } | { outcome: 'address_taken' | 'not_pending' }>;
  /**
   * Records a new ask of ops on a `linked` row still at `from`, bumping the
   * version. A Whitelist request also restarts the whitelist cycle: it is
   * stamped `whitelistRequestedAt`, and the observation is cleared so the
   * reconcile sees the address whitelisted, and emails, once more. False when
   * the row moved meanwhile.
   */
  setOpsRequest(input: {
    id: string;
    from: { opsRequest: WalletLinkOpsRequest; version: number };
    to: WalletLinkOpsRequest;
    at: Date;
  }): Promise<boolean>;
  /** Sets `whitelistObservedAt` on a `linked` row still asking to whitelist at `version`, with none yet; false otherwise. */
  markWhitelistObserved(input: { id: string; version: number; whitelistObservedAt: Date }): Promise<boolean>;
  /** The user's `linked` rows, newest signature first. */
  listLinked(input: { userId: string }): Promise<Array<WalletLinkRecord>>;
  /** Every `linked` row, oldest signature first: what the reconcile holds against the Decisions and the chain. */
  listAllLinked(): Promise<Array<WalletLinkRecord>>;
  /** Drops `pending` challenges that expired before the cut-off; resolves how many. */
  deleteExpiredPending(input: { expiredBefore: Date }): Promise<number>;
  /** The sign-in email and the profile's first name; null when the user is gone. */
  getAccount(input: { userId: string }): Promise<{ email: string; name: string | null } | null>;
};

/**
 * Chainalysis — `flagged` is High or Severe. Rejects when the screen cannot
 * be made; the module then goes ahead `unscreened` (Chainalysis being down
 * must not lock investors out) and the Whitelist request tells ops to screen
 * the address themselves.
 */
export type ScreeningPort = {
  assess(input: { address: Address }): Promise<'clear' | 'flagged'>;
};

/** A screen's outcome as the module acts on it: only `flagged` refuses. */
export type ScreeningVerdict = 'clear' | 'flagged' | 'unscreened';

/**
 * The chain port: contract-aware signature verification on the chain the
 * message names (EOA, EIP-1271 and ERC-6492 through one call) and the
 * whitelist membership of every given address on every active (chain, share
 * class), read in one pass.
 */
export type ChainPort = {
  verifyTypedData(input: {
    chainId: number;
    address: Address;
    typedData: WalletLinkTypedData;
    signature: Hex;
  }): Promise<boolean>;
  readMembership(input: { addresses: ReadonlyArray<Address> }): Promise<Record<Address, AddressMembership>>;
  /**
   * Whether the address is a smart-contract account on that chain, or null
   * when the chain could not be asked. A contract exists per chain, so its
   * Ownership proof holds on the signing chain only; a key controls its
   * address on every chain.
   */
  isSmartAccount(input: { chainId: number; address: Address; signature: Hex }): Promise<boolean | null>;
};

/**
 * One queued job: which link, and the transition it announces — for a
 * request to ops, the `opsRequestVersion` it was queued for; for the email,
 * the `whitelistObservedAt` stamp. `deliverNotification` re-reads the row and
 * compares, so a job the row has moved past is skipped and one it has not
 * caught up with is retried.
 */
export type WalletLinkJob =
  | { kind: 'whitelist_request' | 'revoke_request'; linkId: string; version: number }
  | { kind: 'whitelisted_email'; linkId: string; at: Date };

export type WalletLinkOperatorKind = Extract<WalletLinkJob['kind'], 'whitelist_request' | 'revoke_request'>;

/** Outbox port — QStash in production. Rejects on failure. */
export type WalletLinkOutbox = {
  enqueue(job: WalletLinkJob): Promise<void>;
};

/** Operator message port — the wallet-link Telegram channel. `email` is read at delivery, never carried in the job. */
export type WalletLinkOperatorMessenger = {
  send(input: {
    kind: WalletLinkOperatorKind;
    record: WalletLinkRecord;
    email: string | null;
    /** Read from the chain at delivery; ops is told the proof covers the signing chain only. Null when it could not be read. */
    isSmartAccount: boolean | null;
    /**
     * Where the address stands on every target at delivery, or null when the
     * chains could not be asked at all: a Whitelist request for one frozen
     * somewhere is an unfreeze, not a plain admission.
     */
    membership: AddressMembership | null;
    /** The owner's status when it is not a yes, read at delivery: why a Revoke request is asked. */
    endedBy: VerificationStatus | null;
    /**
     * Chainalysis on the address, asked at delivery of a Whitelist request:
     * what ops checks before admitting it — `unscreened` means screen it by
     * hand. Null on a Revoke request, which is not asked.
     */
    screening: ScreeningVerdict | null;
  }): Promise<void>;
};

/** The one investor email: "your address is whitelisted". Idempotent per (link, `whitelistObservedAt`) on the adapter's side. */
export type WhitelistedEmailSender = {
  send(input: {
    to: string;
    name: string | null;
    address: Address;
    linkId: string;
    whitelistObservedAt: Date;
  }): Promise<void>;
};

export type Clock = { now(): Date };

// ---------------------------------------------------------------------------
// The external seam.
// ---------------------------------------------------------------------------

/** `already_linked`: this account owns the address. `linked_elsewhere`: another one does. */
export type IssueChallengeError = { code: 'not_approved' | 'flagged' | 'already_linked' | 'linked_elsewhere' };

export type CompleteLinkError = {
  code:
    | 'not_approved'
    | 'flagged'
    | 'no_challenge'
    | 'expired'
    | 'bad_signature'
    | 'already_linked'
    | 'linked_elsewhere';
};

/** Who owns an address, as the account asking may know it: itself, another account, or nobody yet. */
export type WalletOwnership = 'mine' | 'elsewhere' | 'none';

/** The same answers the verification receivers map to status codes: retry (early or channel down) or 200 (sent, skipped). */
export type { DeliveryError, DeliveryOutcome } from '@/server/verification/verification';

/** One Linked address in a digest line: where it stands now, on how many chains. */
export type WalletLinkDriftRow = { linkId: string; address: Address; admittedOn: number; total: number };

export type WalletLinkReconcileReport = {
  /** Linked addresses whose membership was read. */
  checked: number;
  /** Rows first seen whitelisted since their latest Whitelist request on this pass (an email each). */
  whitelisted: number;
  /** Revoke requests queued on this pass: the owner's yes no longer stands. */
  revoked: number;
  /** Whitelist requests queued on this pass: the owner is a yes again. */
  restored: number;
  /** Reads that could not conclude on some chain; they stay for the next pass. */
  unchecked: number;
  /** Owners a yes again whose address Chainalysis could not screen: restored all the same, and the request tells ops so. */
  unscreened: number;
  /**
   * Still not whitelisted everywhere on one of the reminder days since the
   * latest Whitelist request — a stalled whitelist. Past the last reminder a
   * request is never reported again.
   */
  stuck: Array<WalletLinkDriftRow & { daysWaiting: number; isLastReminder: boolean }>;
  /** Seen whitelisted since the latest Whitelist request, and no longer admitted everywhere (a freeze, a new chain). */
  lapsed: Array<WalletLinkDriftRow>;
  /** Asked to revoke, and still admitted somewhere: the revoke has not been done. */
  stillAdmitted: Array<WalletLinkDriftRow>;
  /** Owners a yes again whose address Chainalysis now flags: kept revoked, not asked to restore. */
  flagged: Array<{ linkId: string; address: Address }>;
};

export type WalletLink = {
  /**
   * Issues (or re-issues, identically) the challenge for this user and
   * address: the Decision, the owner and Chainalysis are checked first, so a
   * wallet is never asked to sign for an address that could not be linked.
   */
  issueChallenge(input: {
    userId: string;
    address: Address;
    chainId: number;
    walletType: string | null;
    walletName: string | null;
  }): Promise<Result<{ linkId: string; typedData: WalletLinkTypedData }, IssueChallengeError>>;
  /** Verifies the signature against the stored challenge and links the address, telling ops through the Outbox. */
  completeLink(input: {
    userId: string;
    address: Address;
    signature: Hex;
  }): Promise<Result<WalletLinkRecord, CompleteLinkError>>;
  /**
   * Who owns the address, for a yes Decision only — the same answer
   * `issueChallenge` would give, without a challenge. Never who the other
   * account is.
   */
  getOwnership(input: { userId: string; address: Address }): Promise<Result<WalletOwnership, { code: 'not_approved' }>>;
  /** The user's own Linked addresses, newest first. Membership is the chain's to answer, not this read's. */
  listLinks(input: { userId: string }): Promise<Array<WalletLinkRecord>>;
  /**
   * The scheduled sweep: asks ops to revoke the Linked addresses of an owner
   * whose yes no longer stands and to restore those of an owner who is a yes
   * again, then reads membership for every Linked address — the email once a
   * Whitelist request is done, and the digest's drift both ways. Observes and
   * reports; never acts on chain.
   */
  reconcile(input: { now: Date }): Promise<WalletLinkReconcileReport>;
  /** The receiving half of the Outbox: re-reads the row, then sends through the channel for the job's kind. */
  deliverNotification(input: { job: WalletLinkJob }): Promise<Result<DeliveryOutcome, DeliveryError>>;
};

/**
 * How long a challenge stays signable. An EOA signs in seconds and an MPC
 * vault's approvers must answer inside the wallet's own request window; the
 * only reason to wait is a Safe above threshold one, whose co-signers sign
 * in the Safe app and hand the finished signature back on the next click.
 * A business day covers that; a signature nobody completes in a day is
 * abandoned, and "Sign again" issues a fresh one.
 */
const CHALLENGE_TTL_MS = 24 * 60 * 60_000;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * The days after a Whitelist request on which a link still not whitelisted
 * is reported to ops: four reminders, then silence. A request ops chose not
 * to grant would otherwise be repeated every day for ever; the address itself
 * keeps showing its state from the chain. Nothing records a reminder as sent,
 * so one whose digest run fails that day is skipped, not made up later.
 */
const STUCK_REMINDER_DAYS = [3, 7, 14, 30];

export function createWalletLink({
  store,
  verification,
  screening,
  chain,
  outbox,
  operatorMessages,
  whitelistedEmails,
  clock
}: {
  store: WalletLinkStore;
  verification: Pick<Verification, 'getVerificationStatus' | 'listApproved'>;
  screening: ScreeningPort;
  chain: ChainPort;
  outbox: WalletLinkOutbox;
  operatorMessages: WalletLinkOperatorMessenger;
  whitelistedEmails: WhitelistedEmailSender;
  clock: Clock;
}): WalletLink {
  /** Only a yes Decision can link: Persona's for an individual, the team's for an organization. */
  const mayLink = async (userId: string) => isYesDecision(await verification.getVerificationStatus({ userId }));

  /** Fails open: a screen that cannot be made is `unscreened`, never a refusal. */
  const screen = (address: Address): Promise<ScreeningVerdict> =>
    screening.assess({ address }).catch(() => 'unscreened' as const);

  /**
   * Asks ops the other way: the job is queued before the row moves, like
   * every write here, so a write that fails is asked again and the receiver
   * retries a job the row has not reached yet. False when the row moved
   * meanwhile (another sweep or delivery asked first).
   */
  const askOps = async ({ record, to, now }: { record: WalletLinkRecord; to: WalletLinkOpsRequest; now: Date }) => {
    if (record.opsRequest === null) return false;
    await outbox.enqueue({ kind: `${to}_request`, linkId: record.id, version: record.opsRequestVersion + 1 });
    return store.setOpsRequest({
      id: record.id,
      from: { opsRequest: record.opsRequest, version: record.opsRequestVersion },
      to,
      at: now
    });
  };

  /** Best effort: a line of context must not fail the request that carries it. Null when the chains could not be asked. */
  const readOneMembership = (address: Address) =>
    chain
      .readMembership({ addresses: [address] })
      .then((read) => read[address] ?? null)
      .catch(() => null);

  return {
    async issueChallenge({ userId, address: rawAddress, chainId, walletType, walletName }) {
      const address = rawAddress.toLowerCase() as Address;
      if (!(await mayLink(userId))) return err({ code: 'not_approved' });

      // An address has one owner for good: nothing to sign for when it has
      // one. Whose it is stays unsaid — only that it is not this account's.
      const owner = await store.getOwner({ address });
      if (owner) return err({ code: owner.userId === userId ? 'already_linked' : 'linked_elsewhere' });

      // Chainalysis before any signature. A flagged address leaves no row
      // behind; one Chainalysis could not answer for goes on, and is screened
      // again on completion and at delivery.
      if ((await screen(address)) === 'flagged') {
        await store.deletePending({ userId, address });
        return err({ code: 'flagged' });
      }

      // Deterministic for its lifetime: the same payload until it expires, so
      // a Safe whose co-signers finished later can hand back the stored
      // signature on a second click. A different chain is a different
      // domain — wallets refuse a chain id that is not the active one — so
      // that re-issues.
      const now = clock.now();
      const pending = await store.getPending({ userId, address });
      if (pending && pending.expiresAt > now && pending.chainId === chainId) {
        // The same payload, from whichever wallet holds the address now: a
        // first click through MetaMask and a second through WalletConnect
        // must name the second in the operator line and the row.
        if (pending.walletType !== walletType || pending.walletName !== walletName) {
          const { id: _id, ...challenge } = pending;
          await store.putPending({ ...challenge, walletType, walletName });
        }
        return ok({ linkId: pending.id, typedData: pending.typedData });
      }

      const issuedAt = now;
      const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
      const nonce: Hex = `0x${randomBytes(32).toString('hex')}`;
      const typedData = buildWalletLinkTypedData({
        chainId,
        userId,
        address,
        nonce,
        issuedAt,
        expiresAt
      });
      const record = await store.putPending({
        userId,
        address,
        walletType,
        walletName,
        chainId,
        status: 'pending',
        nonce,
        issuedAt,
        expiresAt,
        typedData,
        signature: null,
        signedAt: null,
        whitelistRequestedAt: null,
        whitelistObservedAt: null,
        opsRequest: null,
        opsRequestVersion: 0
      });
      return ok({ linkId: record.id, typedData: record.typedData });
    },

    async completeLink({ userId, address: rawAddress, signature }) {
      const address = rawAddress.toLowerCase() as Address;
      if (!(await mayLink(userId))) return err({ code: 'not_approved' });

      // Linked meanwhile — by this account from another tab, or by another
      // account: the challenge is dead. The unique index refuses it anyway;
      // this spares the screen and the signature check.
      const ownedBy = async () => {
        await store.deletePending({ userId, address });
        const owner = await store.getOwner({ address });
        return err({ code: owner?.userId === userId ? ('already_linked' as const) : ('linked_elsewhere' as const) });
      };

      const now = clock.now();
      const pending = await store.getPending({ userId, address });
      // No challenge left, perhaps because another tab completed it: then the answer is who owns it.
      if (!pending) return (await store.getOwner({ address })) ? ownedBy() : err({ code: 'no_challenge' });
      if (pending.expiresAt <= now) return err({ code: 'expired' });
      if (await store.getOwner({ address })) return ownedBy();

      // Screened again on write: a flag that landed between issue and
      // signature still refuses. Unanswered, it links: the Whitelist request
      // re-screens at delivery and tells ops when it still cannot.
      if ((await screen(address)) === 'flagged') {
        await store.deletePending({ userId, address });
        return err({ code: 'flagged' });
      }

      // Rebuilt from the stored row, never from anything the client posts;
      // the chain decides for EOAs, deployed and counterfactual smart wallets alike.
      const valid = await chain.verifyTypedData({
        chainId: pending.chainId,
        address,
        typedData: pending.typedData,
        signature
      });
      if (!valid) return err({ code: 'bad_signature' });

      // Enqueue before persisting, as the verification write path does: a
      // persist that fails leaves the challenge pending, so the next click
      // re-enqueues and the receiver retries the job until the row reaches
      // its version (or gives up on one that never will).
      const signedAt = now;
      await outbox.enqueue({ kind: 'whitelist_request', linkId: pending.id, version: 1 });

      // By the nonce that was verified: a challenge re-issued for another chain
      // meanwhile sits in the same row, and the signature is not for it.
      const written = await store.link({ id: pending.id, nonce: pending.nonce, signature, signedAt });
      if (written.outcome === 'linked') return ok(written.record);
      // Linked by some account between the check above and the write: the
      // challenge is dropped, so the job queued above finds no row and skips.
      if (written.outcome === 'address_taken') return ownedBy();
      // Completed twice (two tabs, one challenge): the other completion linked
      // it, so the answer is that it is linked, not that the request is dead.
      // Both queued a version 1 job and both match, so ops can see the line twice.
      if (await store.getOwner({ address })) return ownedBy();
      // No longer this challenge (re-issued meanwhile): the job queued above
      // is retried out while the row stays pending. Once it links, that job
      // matches too, as every first link is version 1, so ops can see the
      // line twice, as with any at-least-once delivery.
      return err({ code: 'no_challenge' });
    },

    async getOwnership({ userId, address: rawAddress }) {
      const address = rawAddress.toLowerCase() as Address;
      // Approved investors only, as `issueChallenge`: whether an address is a
      // Zivoe customer's is not an anonymous lookup.
      if (!(await mayLink(userId))) return err({ code: 'not_approved' });
      const owner = await store.getOwner({ address });
      return ok(!owner ? 'none' : owner.userId === userId ? 'mine' : 'elsewhere');
    },

    async listLinks({ userId }) {
      return store.listLinked({ userId });
    },

    async reconcile({ now }) {
      const report: WalletLinkReconcileReport = {
        checked: 0,
        whitelisted: 0,
        revoked: 0,
        restored: 0,
        unchecked: 0,
        unscreened: 0,
        stuck: [],
        lapsed: [],
        stillAdmitted: [],
        flagged: []
      };
      // Whole days since the request, counted from the top of this run's hour:
      // the daily digest run starts a few seconds off the hour each day, and
      // counted from `now` a link requested inside those seconds could skip a
      // reminder day or see one twice.
      const hour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
      const daysWaiting = (requestedAt: Date) => Math.floor((hour - requestedAt.getTime()) / DAY_MS);

      // Housekeeping first: an expired challenge is a row nothing can act on.
      await store.deleteExpiredPending({ expiredBefore: now });

      const owned = await store.listAllLinked();

      // 1. What ops should be asked, from each owner's Decision: whitelist on a
      // yes, revoke on anything else. Read off the record rather than hooked
      // to an act, so an operator's revoke, a reviewer's decline, a reopened
      // KYB case and an approval again are covered alike; a change is asked
      // once, since the row remembers what was asked. One read for every owner.
      const approved = await verification.listApproved({
        userIds: [...new Set(owned.map((record) => record.userId))]
      });
      const current: Array<WalletLinkRecord> = [];
      // A yes again is screened again before ops is asked to restore, as a new
      // link is, and fails open the same way. Started together, so a slow
      // Chainalysis costs one timeout however many wait; and owners who are
      // not a yes go first below, so it never holds up a freeze.
      const screens = new Map(
        owned
          .filter((record) => record.opsRequest === 'revoke' && approved.has(record.userId))
          .map((record) => [record.id, screen(record.address)])
      );
      const revokesFirst = [...owned].sort((a, b) => Number(approved.has(a.userId)) - Number(approved.has(b.userId)));
      for (const record of revokesFirst) {
        const wanted: WalletLinkOpsRequest = approved.has(record.userId) ? 'whitelist' : 'revoke';
        if (record.opsRequest === null || record.opsRequest === wanted) {
          current.push(record);
          continue;
        }
        if (wanted === 'whitelist') {
          const risk = await screens.get(record.id);
          if (risk === 'unscreened') report.unscreened += 1;
          if (risk === 'flagged') {
            report.flagged.push({ linkId: record.id, address: record.address });
            current.push(record);
            continue;
          }
        }
        const version = record.opsRequestVersion + 1;
        if (!(await askOps({ record, to: wanted, now }))) {
          current.push(record);
          continue;
        }
        if (wanted === 'whitelist') report.restored += 1;
        else report.revoked += 1;
        current.push({
          ...record,
          opsRequest: wanted,
          opsRequestVersion: version,
          ...(wanted === 'whitelist' ? { whitelistRequestedAt: now, whitelistObservedAt: null } : {})
        });
      }

      // 2. Where every Linked address stands: one pass over the chains for
      // every row at once; the chain port batches per share token.
      const membership = await chain.readMembership({ addresses: current.map((record) => record.address) });
      report.checked = current.length;

      for (const record of current) {
        const summary = summarizeMembership(membership[record.address] ?? []);
        const drift = {
          linkId: record.id,
          address: record.address,
          admittedOn: summary.admittedOn,
          total: summary.total
        };

        // One chain admitting it settles that a revoke is not done, whatever another chain answers.
        if (record.opsRequest === 'revoke' && summary.admittedOn > 0) report.stillAdmitted.push(drift);
        if (summary.status === 'unchecked') {
          report.unchecked += 1;
          continue;
        }
        if (record.opsRequest === 'revoke') continue;

        if (summary.status === 'whitelisted') {
          if (record.whitelistObservedAt) continue;
          // The email is queued before the stamp lands, like every other
          // notification here; the receiver matches the stamp, so a persist
          // that fails is re-queued next pass and a delivered job is sent once.
          await outbox.enqueue({ kind: 'whitelisted_email', linkId: record.id, at: now });
          if (
            await store.markWhitelistObserved({
              id: record.id,
              version: record.opsRequestVersion,
              whitelistObservedAt: now
            })
          ) {
            report.whitelisted += 1;
          }
        } else if (record.whitelistObservedAt) {
          report.lapsed.push(drift);
        } else if (record.whitelistRequestedAt) {
          const days = daysWaiting(record.whitelistRequestedAt);
          if (STUCK_REMINDER_DAYS.includes(days)) {
            report.stuck.push({ ...drift, daysWaiting: days, isLastReminder: days === STUCK_REMINDER_DAYS.at(-1) });
          }
        }
      }

      return report;
    },

    async deliverNotification({ job }) {
      const record = await store.get({ id: job.linkId });
      // A row that is gone (a challenge dropped) has nobody left to tell.
      if (!record) return ok('skipped');

      try {
        switch (job.kind) {
          case 'whitelist_request':
          case 'revoke_request': {
            // Still a challenge: the link's persist has not landed yet.
            if (record.status === 'pending') return err({ code: 'not_caught_up' });
            if (record.status !== 'linked') return ok('skipped');
            // The row has not reached the change this job announces, or has
            // moved past it (asked the other way since): retry, or skip — a
            // later job carries what ops must hear now.
            if (record.opsRequestVersion < job.version) return err({ code: 'not_caught_up' });
            if (record.opsRequestVersion > job.version || `${record.opsRequest}_request` !== job.kind) {
              return ok('skipped');
            }

            // Every change is told to ops, whatever the chain shows now: a
            // request may supersede an earlier, opposite one ops has not acted
            // on yet, and only this message cancels it.
            // Read together: run one after another, slow chains could use up
            // the receiver's time before Telegram is called.
            const [decision, membership, account, isSmartAccount, screening] = await Promise.all([
              verification.getVerificationStatus({ userId: record.userId }),
              readOneMembership(record.address),
              store.getAccount({ userId: record.userId }),
              // A linked row always carries its signature (the database checks
              // it); the fallback only types the field. Best effort, like membership.
              record.signature
                ? chain
                    .isSmartAccount({ chainId: record.chainId, address: record.address, signature: record.signature })
                    .catch(() => null)
                : false,
              // Asked again here rather than carried from the link: a link
              // made while Chainalysis was down is screened now if it is back.
              job.kind === 'whitelist_request' ? screen(record.address) : null
            ]);
            const isYes = isYesDecision(decision);
            // No longer a yes inside the queue's delay: nobody to admit. The
            // row is moved to a revoke here, as the sweep would, so the change
            // is never only skipped — an approval again then asks to restore
            // anew, whether or not a sweep saw the no in between. A Whitelist
            // request in the channel is one for a verified investor.
            if (job.kind === 'whitelist_request' && !isYes) {
              await askOps({ record, to: 'revoke', now: clock.now() });
              return ok('skipped');
            }

            // The reads above take seconds; a later request may have been
            // asked and sent meanwhile. Sending this one after it would read
            // as cancelling it.
            const latest = await store.get({ id: record.id });
            if (latest?.opsRequestVersion !== job.version) return ok('skipped');
            await operatorMessages.send({
              kind: job.kind,
              record,
              email: account?.email ?? null,
              isSmartAccount,
              membership,
              endedBy: isYes ? null : decision.status,
              screening
            });
            return ok('sent');
          }
          case 'whitelisted_email': {
            // Asked to revoke since the sweep saw it: nothing to announce.
            if (record.status !== 'linked' || record.opsRequest !== 'whitelist') return ok('skipped');
            if (!record.whitelistObservedAt) return err({ code: 'not_caught_up' });
            if (record.whitelistObservedAt.getTime() !== job.at.getTime()) return ok('skipped');
            if (!(await mayLink(record.userId))) return ok('skipped');
            const account = await store.getAccount({ userId: record.userId });
            if (!account) return ok('skipped');
            await whitelistedEmails.send({
              to: account.email,
              name: account.name,
              address: record.address,
              linkId: record.id,
              whitelistObservedAt: record.whitelistObservedAt
            });
            return ok('sent');
          }
        }
      } catch (cause) {
        return err({ code: 'send_failed', cause });
      }
    }
  };
}
