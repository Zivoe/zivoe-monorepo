import { type Address, type Hex, verifyTypedData } from 'viem';

import { type KycStatusView } from '@/server/kyc/kyc-status';

import {
  type ChainPort,
  type ScreeningPort,
  type WalletLinkJob,
  type WalletLinkOperatorMessenger,
  type WalletLinkOutbox,
  type WalletLinkRecord,
  type WalletLinkStore,
  type WhitelistedEmailSender
} from './wallet-link';
import { type AddressMembership, type MembershipTarget, type MembershipVerdict } from './wallet-link-membership';
import { toSignableTypedData } from './wallet-link-typed-data';

// ---------------------------------------------------------------------------
// In-memory adapters for the module's ports. TEST-ONLY: nothing on a
// production code path imports this file.
// ---------------------------------------------------------------------------

export function createInMemoryWalletLinkStore() {
  const records = new Map<string, WalletLinkRecord>();
  /** `wallet_connection`, as "user:address" keys — what the link write must guarantee. */
  const connections = new Set<string>();
  const accounts = new Map<string, { email: string; name: string | null }>();
  let sequence = 0;

  const linkedFor = ({ userId, address }: { userId: string; address: Address }) =>
    [...records.values()].find(
      (record) => record.status === 'linked' && record.userId === userId && record.address === address
    ) ?? null;

  const store: WalletLinkStore = {
    async get({ id }) {
      const record = records.get(id);
      return record ? { ...record } : null;
    },
    async getPending({ userId, address }) {
      const record = [...records.values()].find(
        (candidate) => candidate.status === 'pending' && candidate.userId === userId && candidate.address === address
      );
      return record ? { ...record } : null;
    },
    async getLinked(input) {
      const record = linkedFor(input);
      return record ? { ...record } : null;
    },
    async putPending(record) {
      // Like the real upsert: a pending row for the pair keeps its id, so a refreshed challenge is the same link.
      const existing = await store.getPending({ userId: record.userId, address: record.address });
      const id = existing?.id ?? `link_${(sequence += 1)}`;
      const stored: WalletLinkRecord = { ...record, id };
      records.set(id, stored);
      return { ...stored };
    },
    async deletePending({ userId, address }) {
      for (const [id, record] of records) {
        if (record.status === 'pending' && record.userId === userId && record.address === address) records.delete(id);
      }
    },
    async link({ id, nonce, signature, signedAt }) {
      const record = records.get(id);
      if (record?.status !== 'pending' || record.nonce !== nonce) return { outcome: 'not_pending' };
      // The partial unique index: one `linked` row per (user, address).
      if (linkedFor(record)) return { outcome: 'already_linked' };
      connections.add(`${record.userId}:${record.address}`);
      const linked: WalletLinkRecord = {
        ...record,
        status: 'linked',
        signature,
        signedAt,
        whitelistRequestedAt: signedAt
      };
      records.set(id, linked);
      return { outcome: 'linked', record: { ...linked } };
    },
    async remove({ id, removedAt }) {
      const record = records.get(id);
      if (record?.status !== 'linked') return false;
      records.set(id, { ...record, status: 'removed', removedAt });
      return true;
    },
    async markWhitelistObserved({ id, whitelistObservedAt }) {
      const record = records.get(id);
      if (record?.status !== 'linked' || record.whitelistObservedAt) return false;
      records.set(id, { ...record, whitelistObservedAt });
      return true;
    },
    async listLinked({ userId }) {
      return [...records.values()]
        .filter((record) => record.status === 'linked' && record.userId === userId)
        .sort((a, b) => (b.signedAt?.getTime() ?? 0) - (a.signedAt?.getTime() ?? 0))
        .map((record) => ({ ...record }));
    },
    async listAwaitingWhitelist() {
      return [...records.values()]
        .filter((record) => record.status === 'linked' && !record.whitelistObservedAt)
        .map((record) => ({ ...record }));
    },
    async listWhitelistObserved() {
      return [...records.values()]
        .filter((record) => record.status === 'linked' && !!record.whitelistObservedAt)
        .map((record) => ({ ...record }));
    },
    async deleteExpiredPending({ expiredBefore }) {
      let deleted = 0;
      for (const [id, record] of records) {
        if (record.status === 'pending' && record.expiresAt < expiredBefore) {
          records.delete(id);
          deleted += 1;
        }
      }
      return deleted;
    },
    async listOtherConnectedAccounts({ address, exceptUserId }) {
      return [...connections]
        .map((key) => key.split(':') as [string, string])
        .filter(([userId, connected]) => connected === address && userId !== exceptUserId)
        .flatMap(([userId]) => {
          const account = accounts.get(userId);
          return account ? [{ userId, email: account.email }] : [];
        })
        .sort((a, b) => a.email.localeCompare(b.email));
    },
    async getAccount({ userId }) {
      return accounts.get(userId) ?? null;
    }
  };

  return { store, records, connections, accounts };
}

/** Chainalysis as a set of flagged addresses. */
export function createFakeScreening() {
  const flagged = new Set<string>();
  const calls: Array<Address> = [];
  const screening: ScreeningPort = {
    async assess({ address }) {
      calls.push(address);
      return flagged.has(address.toLowerCase()) ? 'flagged' : 'clear';
    }
  };
  return { screening, flagged, calls };
}

/**
 * The chain, offline: EOA signatures are verified with viem's pure
 * `verifyTypedData` (ECDSA recovery); a smart wallet is any address listed
 * in `smartWallets`, which accepts exactly the signature registered for it —
 * the shape of an EIP-1271 `isValidSignature` answer without a contract.
 * Membership is a map from address to one verdict per target.
 */
export function createFakeChain({ targets }: { targets: Array<MembershipTarget> }) {
  const smartWallets = new Map<string, Hex>();
  const membership = new Map<string, Array<MembershipVerdict>>();
  const verifications: Array<{ chainId: number; address: Address }> = [];
  let membershipFailure: Error | null = null;

  const chain: ChainPort = {
    async verifyTypedData({ chainId, address, typedData, signature }) {
      verifications.push({ chainId, address });
      const registered = smartWallets.get(address.toLowerCase());
      if (registered !== undefined) return registered === signature;
      return verifyTypedData({ address, signature, ...toSignableTypedData(typedData) }).catch(() => false);
    },
    async isSmartAccount({ address }) {
      return smartWallets.has(address.toLowerCase());
    },
    async readMembership({ addresses }): Promise<Record<Address, AddressMembership>> {
      if (membershipFailure) throw membershipFailure;
      return Object.fromEntries(
        addresses.map((address) => {
          const verdicts = membership.get(address.toLowerCase());
          return [address, targets.map((target, index) => ({ target, verdict: verdicts?.[index] ?? 'not-member' }))];
        })
      );
    }
  };

  return {
    chain,
    smartWallets,
    membership,
    verifications,
    /** Every membership read rejects until cleared: the chains cannot be asked at all. */
    failMembershipReads(error: Error | null) {
      membershipFailure = error;
    },
    /** One verdict for every target. */
    setMembership(address: Address, verdict: MembershipVerdict | Array<MembershipVerdict>) {
      membership.set(address.toLowerCase(), Array.isArray(verdict) ? verdict : targets.map(() => verdict));
    }
  };
}

export function createInMemoryWalletLinkOutbox() {
  const jobs: Array<WalletLinkJob> = [];
  let nextFailure: Error | null = null;
  const outbox: WalletLinkOutbox = {
    async enqueue(job) {
      if (nextFailure) {
        const failure = nextFailure;
        nextFailure = null;
        throw failure;
      }
      jobs.push(job);
    }
  };
  return {
    outbox,
    jobs,
    failNextCall(error: Error) {
      nextFailure = error;
    }
  };
}

export function createInMemoryWalletLinkOperatorMessenger() {
  const sent: Array<Parameters<WalletLinkOperatorMessenger['send']>[0]> = [];
  let nextFailure: Error | null = null;
  const messenger: WalletLinkOperatorMessenger = {
    async send(input) {
      if (nextFailure) {
        const failure = nextFailure;
        nextFailure = null;
        throw failure;
      }
      sent.push(input);
    }
  };
  return {
    messenger,
    sent,
    failNextCall(error: Error) {
      nextFailure = error;
    }
  };
}

export function createInMemoryWhitelistedEmailSender() {
  const sent: Array<Parameters<WhitelistedEmailSender['send']>[0]> = [];
  const sender: WhitelistedEmailSender = {
    async send(input) {
      sent.push(input);
    }
  };
  return { sender, sent };
}

/** The Decision gate as a map from user id to status view; unknown users read as not started. */
export function createFakeKyc() {
  const views = new Map<string, KycStatusView>();
  const kyc = {
    async getKycStatus({ userId }: { userId: string }): Promise<KycStatusView> {
      return (
        views.get(userId) ?? {
          status: 'not_started',
          path: 'individual',
          canStart: true,
          canResume: false,
          inquiryId: null
        }
      );
    }
  };
  return {
    kyc,
    set(userId: string, view: Partial<KycStatusView>) {
      views.set(userId, {
        status: 'approved',
        path: 'individual',
        canStart: false,
        canResume: false,
        inquiryId: null,
        ...view
      });
    }
  };
}
