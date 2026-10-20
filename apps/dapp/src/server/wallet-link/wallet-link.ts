import { randomBytes } from 'node:crypto';
import { type Address, type Hex } from 'viem';

import { type WalletLinkStatus } from '@zivoe/database/wallet-link';

import { type KycStatusView, isNoDecision, isYesDecision } from '@/server/kyc/kyc-status';
import { type DeliveryError, type DeliveryOutcome } from '@/server/kyc/kyc-verification';

import { type Result, err, ok } from '@/lib/result';

import { type AddressMembership, summarizeMembership } from './wallet-link-membership';
import { type WalletLinkTypedData, buildWalletLinkTypedData } from './wallet-link-typed-data';

// ---------------------------------------------------------------------------
// Wallet link — one account's signed request to whitelist one address. One
// module, five operations, over injected ports: the store,
// the Decision (KYC Verification), Chainalysis, the chain (signature
// verification and whitelist membership), the Outbox and the two channels.
// Production wires Postgres / viem / QStash / Telegram / Resend; tests wire
// the in-memory adapters in wallet-link.fakes.ts. The signed message lives in
// wallet-link-typed-data.ts and the membership vocabulary in
// wallet-link-membership.ts so the client shares both without this file.
// ---------------------------------------------------------------------------

/**
 * One Wallet link challenge and what became of it: which account asked for
 * which address. `address` is lowercase, and not bound to one account —
 * several may each have asked for it.
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
  /** When the Whitelist request was queued for ops. */
  whitelistRequestedAt: Date | null;
  /** When the reconcile first observed membership everywhere — a record, not the truth; the chain is. */
  whitelistObservedAt: Date | null;
  removedAt: Date | null;
};

/** Store port — the app database. Rejects on infrastructure failure. */
export type WalletLinkStore = {
  get(input: { id: string }): Promise<WalletLinkRecord | null>;
  getPending(input: { userId: string; address: Address }): Promise<WalletLinkRecord | null>;
  /** The user's `linked` row for an address. Another account's is never read here. */
  getLinked(input: { userId: string; address: Address }): Promise<WalletLinkRecord | null>;
  /** Writes a pending challenge, replacing the user's existing pending one for the address. */
  putPending(record: Omit<WalletLinkRecord, 'id'>): Promise<WalletLinkRecord>;
  deletePending(input: { userId: string; address: Address }): Promise<void>;
  /**
   * In one transaction: ensures `wallet_connection` holds (user, address) —
   * a no-op when the tracker already recorded it — and flips the pending row
   * to `linked`. `already_linked` when the partial unique index refuses (the
   * user's own earlier challenge for this address was completed meanwhile);
   * `not_pending` when the row
   * is no longer the pending challenge `nonce` names — linked, gone, or
   * re-issued (a re-issue keeps the row and replaces what it asks to sign).
   */
  link(input: {
    id: string;
    nonce: Hex;
    signature: Hex;
    signedAt: Date;
  }): Promise<{ outcome: 'linked'; record: WalletLinkRecord } | { outcome: 'already_linked' | 'not_pending' }>;
  /** Flips a `linked` row to `removed`; false when it was not linked. */
  remove(input: { id: string; removedAt: Date }): Promise<boolean>;
  /** Sets `whitelistObservedAt` on a `linked` row that has none; false otherwise. */
  markWhitelistObserved(input: { id: string; whitelistObservedAt: Date }): Promise<boolean>;
  /** The user's `linked` rows, newest signature first. */
  listLinked(input: { userId: string }): Promise<Array<WalletLinkRecord>>;
  /** `linked` rows the reconcile has not yet seen whitelisted. */
  listAwaitingWhitelist(): Promise<Array<WalletLinkRecord>>;
  /** `linked` rows the reconcile has seen whitelisted — out of the chain read, still under the Decision check. */
  listWhitelistObserved(): Promise<Array<WalletLinkRecord>>;
  /** Drops `pending` challenges that expired before the cut-off; resolves how many. */
  deleteExpiredPending(input: { expiredBefore: Date }): Promise<number>;
  /**
   * Every other account that connected this address in the dapp
   * (`wallet_connection`), linked or not — who else a revoke touches.
   */
  listOtherConnectedAccounts(input: {
    address: Address;
    exceptUserId: string;
  }): Promise<Array<{ userId: string; email: string }>>;
  /** The sign-in email and the profile's first name; null when the user is gone. */
  getAccount(input: { userId: string }): Promise<{ email: string; name: string | null } | null>;
};

/** Chainalysis — `flagged` is High or Severe. Rejects when the screen cannot be made; nothing is linked then. */
export type ScreeningPort = {
  assess(input: { address: Address }): Promise<'clear' | 'flagged'>;
};

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
   * Whether the address is a smart-contract account on that chain. A contract
   * exists per chain, so its Ownership proof holds on the signing chain only;
   * a key controls its address on every chain.
   */
  isSmartAccount(input: { chainId: number; address: Address; signature: Hex }): Promise<boolean>;
};

/**
 * One queued job: which link, and the stamp of the transition it announces
 * (`signedAt`, `removedAt` or `whitelistObservedAt`). `deliverNotification`
 * re-reads the row and compares, so a job the row has moved past is skipped
 * and one it has not caught up with is retried.
 */
export type WalletLinkJob = {
  linkId: string;
  at: Date;
  kind: 'whitelist_request' | 'revoke_request' | 'whitelisted_email';
};

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
    /** Read from the chain at delivery; ops is told the proof covers the signing chain only. */
    isSmartAccount: boolean;
    /**
     * Where the address stands on every target at delivery, or null when the
     * chains could not be asked at all: a Revoke request for an address that
     * is a member nowhere needs no action, and a Whitelist request for one
     * already frozen somewhere is not a plain admission.
     */
    membership: AddressMembership | null;
    /** The investor's Decision when it is a no, read at delivery: why a Revoke request is asked. */
    noDecision: 'declined' | 'revoked' | null;
    /**
     * On a Revoke request, the other accounts that connected the address: it
     * is not bound to one account, and ops decides with all of them in view.
     * `isVerified` is a yes Verification Status at delivery — an approved
     * investor still using the wallet, as against an account that only
     * connected it once.
     */
    otherAccounts: Array<{ email: string; isVerified: boolean }>;
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

export type IssueChallengeError = { code: 'not_approved' | 'flagged' | 'already_linked' };

export type CompleteLinkError = {
  code: 'not_approved' | 'flagged' | 'no_challenge' | 'expired' | 'bad_signature' | 'already_linked';
};

/** The same answers the KYC receivers map to status codes: retry (early or channel down) or 200 (sent, skipped). */
export type { DeliveryError, DeliveryOutcome } from '@/server/kyc/kyc-verification';

export type WalletLinkReconcileReport = {
  /** Rows whose membership was read. */
  checked: number;
  /** Rows first seen whitelisted on this pass (an email each). */
  whitelisted: number;
  /** Linked rows removed on this pass because their investor's Decision became a no (a Revoke request each). */
  ended: number;
  /** Reads that could not conclude on some chain; they stay for the next pass. */
  unchecked: number;
  /**
   * Still not a member everywhere on one of the reminder days since the
   * request — a stalled whitelist. Past the last reminder a link is never
   * reported again.
   */
  stuck: Array<{
    linkId: string;
    address: Address;
    memberOn: number;
    total: number;
    daysWaiting: number;
    isLastReminder: boolean;
  }>;
};

export type WalletLink = {
  /**
   * Issues (or re-issues, identically) the challenge for this user and
   * address: the Decision and Chainalysis are checked first, so a wallet is
   * never asked to sign for an address that could not be linked. What other
   * accounts asked for the same address plays no part.
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
  /** The user's own live requests, newest first. Membership is the chain's to answer, not this read's. */
  listLinks(input: { userId: string }): Promise<Array<WalletLinkRecord>>;
  /**
   * The scheduled sweep: removes the Linked addresses of an investor whose
   * Decision became a no, then reads membership for every linked row not yet
   * seen whitelisted. Observes and reports; never retries anything on chain.
   * A row seen whitelisted once is not read again: what ops does to a
   * membership afterwards (a revoke on request, a freeze) is theirs to know.
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
 * The days after a request on which a link still not whitelisted is reported
 * to ops: four reminders, then silence. A request ops chose not to grant
 * would otherwise be repeated every day for ever; the address itself keeps
 * showing its state from the chain. Nothing records a reminder as sent, so
 * one whose digest run fails that day is skipped, not made up later.
 */
const STUCK_REMINDER_DAYS = [3, 7, 14, 30];

export function createWalletLink({
  store,
  kyc,
  screening,
  chain,
  outbox,
  operatorMessages,
  whitelistedEmails,
  clock
}: {
  store: WalletLinkStore;
  kyc: { getKycStatus(input: { userId: string }): Promise<KycStatusView> };
  screening: ScreeningPort;
  chain: ChainPort;
  outbox: WalletLinkOutbox;
  operatorMessages: WalletLinkOperatorMessenger;
  whitelistedEmails: WhitelistedEmailSender;
  clock: Clock;
}): WalletLink {
  /** Only a yes Decision can link: Persona's for an individual, the team's for an organization. */
  const mayLink = async (userId: string) => isYesDecision(await kyc.getKycStatus({ userId }));

  /** A Whitelist or Revoke request, with what only delivery can read: the email, the kind of account and the Decision. */
  const sendOperatorMessage = async (kind: WalletLinkOperatorKind, record: WalletLinkRecord) => {
    const [account, isSmartAccount, membership, decision, connected] = await Promise.all([
      store.getAccount({ userId: record.userId }),
      // A linked or removed row always carries its signature; the fallback only types the field.
      record.signature
        ? chain.isSmartAccount({ chainId: record.chainId, address: record.address, signature: record.signature })
        : false,
      // Best effort, like the probe above: a line of context must not fail the request that carries it.
      chain
        .readMembership({ addresses: [record.address] })
        .then((read) => read[record.address] ?? null)
        .catch(() => null),
      kyc.getKycStatus({ userId: record.userId }),
      kind === 'revoke_request'
        ? store.listOtherConnectedAccounts({ address: record.address, exceptUserId: record.userId })
        : []
    ]);
    const otherAccounts = await Promise.all(
      connected.map(async ({ userId, email }) => ({
        email,
        isVerified: isYesDecision(await kyc.getKycStatus({ userId }))
      }))
    );
    await operatorMessages.send({
      kind,
      record,
      email: account?.email ?? null,
      isSmartAccount,
      membership,
      noDecision: isNoDecision(decision) ? decision.status : null,
      otherAccounts
    });
  };

  /**
   * The sweep's removal — the only one: an investor cannot take an address
   * back (they write to the team). The Revoke request is queued before the
   * row flips, like every write here.
   */
  const remove = async ({ id, removedAt }: { id: string; removedAt: Date }) => {
    await outbox.enqueue({ kind: 'revoke_request', linkId: id, at: removedAt });
    return store.remove({ id, removedAt });
  };

  return {
    async issueChallenge({ userId, address: rawAddress, chainId, walletType, walletName }) {
      const address = rawAddress.toLowerCase() as Address;
      if (!(await mayLink(userId))) return err({ code: 'not_approved' });

      // An address this account already asked for has nothing to sign for.
      // Only its own rows are read: what another account asked for is never
      // told, or anyone could probe which addresses are Zivoe customers.
      if (await store.getLinked({ userId, address })) return err({ code: 'already_linked' });

      // Chainalysis before any signature. A flagged address leaves no row behind.
      if ((await screening.assess({ address })) === 'flagged') {
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

      const account = await store.getAccount({ userId });
      // Unreachable past the Decision gate (an approved user has a profile); typed for the compiler.
      if (!account) return err({ code: 'not_approved' });

      const issuedAt = now;
      const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
      const nonce: Hex = `0x${randomBytes(32).toString('hex')}`;
      const typedData = buildWalletLinkTypedData({
        chainId,
        email: account.email,
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
        removedAt: null
      });
      return ok({ linkId: record.id, typedData: record.typedData });
    },

    async completeLink({ userId, address: rawAddress, signature }) {
      const address = rawAddress.toLowerCase() as Address;
      if (!(await mayLink(userId))) return err({ code: 'not_approved' });

      const now = clock.now();
      const pending = await store.getPending({ userId, address });
      if (!pending) return err({ code: 'no_challenge' });
      if (pending.expiresAt <= now) return err({ code: 'expired' });

      // Screened again on write: a flag that landed between issue and signature still refuses.
      if ((await screening.assess({ address })) === 'flagged') {
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

      // Enqueue before persisting, as the KYC write path does: a persist that
      // fails leaves the challenge pending, so the next click re-enqueues and
      // the receiver tells the stale job from the live one by `signedAt`.
      const signedAt = now;
      await outbox.enqueue({ kind: 'whitelist_request', linkId: pending.id, at: signedAt });

      // By the nonce that was verified: a challenge re-issued for another chain
      // meanwhile sits in the same row, and the signature is not for it.
      const written = await store.link({ id: pending.id, nonce: pending.nonce, signature, signedAt });
      if (written.outcome === 'linked') return ok(written.record);
      if (written.outcome === 'already_linked') {
        // A second challenge for an address this account linked meanwhile: it
        // is dead, and dropping it is what makes the job queued above find no
        // row and skip.
        await store.deletePending({ userId, address });
        return err({ code: 'already_linked' });
      }
      // No longer this challenge (re-issued meanwhile, or completed twice): the
      // job queued above never matches the row — skipped once it is linked,
      // retried out while it stays pending.
      return err({ code: 'no_challenge' });
    },

    async listLinks({ userId }) {
      return store.listLinked({ userId });
    },

    async reconcile({ now }) {
      const report: WalletLinkReconcileReport = {
        checked: 0,
        whitelisted: 0,
        ended: 0,
        unchecked: 0,
        stuck: []
      };
      // Whole days since the request, counted from the top of this run's hour:
      // the daily digest run starts a few seconds off the hour each day, and
      // counted from `now` a link requested inside those seconds could skip a
      // reminder day or see one twice.
      const hour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
      const daysWaiting = (requestedAt: Date) => Math.floor((hour - requestedAt.getTime()) / DAY_MS);

      // Housekeeping first: an expired challenge is a row nothing can act on.
      await store.deleteExpiredPending({ expiredBefore: now });

      const [allAwaiting, allObserved] = await Promise.all([
        store.listAwaitingWhitelist(),
        store.listWhitelistObserved()
      ]);

      // A Decision that became a no since the link ends it: the row is removed
      // and ops is asked to revoke. Read off the
      // record here rather than hooked to an act, so an operator's revoke and
      // a reviewer's decline in Persona are covered alike.
      const ended = new Map<string, boolean>();
      for (const record of [...allAwaiting, ...allObserved]) {
        if (!ended.has(record.userId)) {
          ended.set(record.userId, isNoDecision(await kyc.getKycStatus({ userId: record.userId })));
        }
        if (ended.get(record.userId) && (await remove({ id: record.id, removedAt: now }))) report.ended += 1;
      }
      const awaiting = allAwaiting.filter((record) => !ended.get(record.userId));

      // One pass over the chains for every row at once; the chain port batches
      // per share token. Two accounts may have asked for one address.
      const membership = await chain.readMembership({
        addresses: [...new Set(awaiting.map((record) => record.address))]
      });
      report.checked = awaiting.length;

      for (const record of awaiting) {
        const summary = summarizeMembership(membership[record.address] ?? []);
        if (summary.status === 'unchecked') {
          report.unchecked += 1;
        } else if (summary.status === 'whitelisted') {
          // The email is queued before the stamp lands, like every other
          // notification here; the receiver matches the stamp, so a persist
          // that fails is re-queued next pass and a delivered job is sent once.
          await outbox.enqueue({ kind: 'whitelisted_email', linkId: record.id, at: now });
          if (await store.markWhitelistObserved({ id: record.id, whitelistObservedAt: now })) report.whitelisted += 1;
        } else if (record.whitelistRequestedAt) {
          const days = daysWaiting(record.whitelistRequestedAt);
          if (STUCK_REMINDER_DAYS.includes(days)) {
            report.stuck.push({
              linkId: record.id,
              address: record.address,
              memberOn: summary.memberOn,
              total: summary.total,
              daysWaiting: days,
              isLastReminder: days === STUCK_REMINDER_DAYS.at(-1)
            });
          }
        }
      }

      return report;
    },

    async deliverNotification({ job }) {
      const record = await store.get({ id: job.linkId });
      // A row that is gone (its user deleted) has nobody left to tell.
      if (!record) return ok('skipped');

      const sameStamp = (stamp: Date | null) => stamp !== null && stamp.getTime() === job.at.getTime();

      try {
        switch (job.kind) {
          case 'whitelist_request': {
            // Still a challenge: the link's persist has not landed yet.
            if (record.status === 'pending') return err({ code: 'not_caught_up' });
            // Removed since (the Decision became a no): asking ops to whitelist it would
            // only undo the revoke that was queued after it (deliveries are not ordered).
            if (record.status === 'removed' || !sameStamp(record.signedAt)) return ok('skipped');
            // No longer a yes inside the queue's delay: nobody to admit. A
            // request in the channel is one for a verified investor.
            if (!(await mayLink(record.userId))) return ok('skipped');
            await sendOperatorMessage('whitelist_request', record);
            return ok('sent');
          }
          case 'revoke_request': {
            if (record.status !== 'removed') return err({ code: 'not_caught_up' });
            if (!sameStamp(record.removedAt)) return ok('skipped');
            await sendOperatorMessage('revoke_request', record);
            return ok('sent');
          }
          case 'whitelisted_email': {
            // Removed since the sweep saw it (or before the stamp landed): nothing to announce.
            if (record.status !== 'linked') return ok('skipped');
            if (!record.whitelistObservedAt) return err({ code: 'not_caught_up' });
            if (!sameStamp(record.whitelistObservedAt)) return ok('skipped');
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
