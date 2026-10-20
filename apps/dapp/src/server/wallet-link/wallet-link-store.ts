import 'server-only';

import { and, desc, eq, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
import { type Address, type Hex } from 'viem';

import { profile, user, walletConnection, walletLink } from '@zivoe/database/schema';
import { WALLET_LINK_LINKED_USER_ADDRESS_INDEX } from '@zivoe/database/wallet-link';

import { type Db } from '@/server/clients/db';

import { type WalletLinkRecord, type WalletLinkStore } from './wallet-link';
import { type WalletLinkTypedData } from './wallet-link-typed-data';

const columns = {
  id: walletLink.id,
  userId: walletLink.userId,
  address: walletLink.address,
  walletType: walletLink.walletType,
  walletName: walletLink.walletName,
  chainId: walletLink.chainId,
  status: walletLink.status,
  nonce: walletLink.nonce,
  issuedAt: walletLink.issuedAt,
  expiresAt: walletLink.expiresAt,
  typedData: walletLink.typedData,
  signature: walletLink.signature,
  signedAt: walletLink.signedAt,
  whitelistRequestedAt: walletLink.whitelistRequestedAt,
  whitelistObservedAt: walletLink.whitelistObservedAt,
  removedAt: walletLink.removedAt
};

/** What `select(columns)` yields: the table's own types, nullable where the column is. */
type Row = Pick<typeof walletLink.$inferSelect, keyof typeof columns>;

// The column types are the storage's (text, jsonb); the record's are the
// module's (Address, Hex, the typed-data shape). The lowercase check
// constraint and the one writer of `typed_data` are what make these casts true.
const toRecord = (row: Row): WalletLinkRecord => ({
  ...row,
  address: row.address as Address,
  nonce: row.nonce as Hex,
  typedData: row.typedData as WalletLinkTypedData,
  signature: row.signature as Hex | null
});

/** Postgres' unique_violation on the one `linked` row per (user, address). */
const isAlreadyLinked = (error: unknown) => {
  const candidate = (error instanceof Error && 'cause' in error && error.cause ? error.cause : error) as {
    code?: string;
    constraint_name?: string;
  };
  return candidate?.code === '23505' && candidate.constraint_name === WALLET_LINK_LINKED_USER_ADDRESS_INDEX;
};

/** The WalletLinkStore port over drizzle. Infrastructure failures reject, as the port allows. */
export function createPostgresWalletLinkStore({ db }: { db: Db }): WalletLinkStore {
  const one = async (where: ReturnType<typeof and>) => {
    const rows = await db.select(columns).from(walletLink).where(where).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  };

  return {
    get: ({ id }) => one(eq(walletLink.id, id)),

    getPending: ({ userId, address }) =>
      one(and(eq(walletLink.userId, userId), eq(walletLink.address, address), eq(walletLink.status, 'pending'))),

    getLinked: ({ userId, address }) =>
      one(and(eq(walletLink.userId, userId), eq(walletLink.address, address), eq(walletLink.status, 'linked'))),

    async putPending(record) {
      // The partial unique index on (user, address) where pending: a re-issue replaces, never piles up.
      const [row] = await db
        .insert(walletLink)
        .values(record)
        .onConflictDoUpdate({
          target: [walletLink.userId, walletLink.address],
          targetWhere: sql`${walletLink.status} = 'pending'`,
          set: {
            walletType: record.walletType,
            walletName: record.walletName,
            chainId: record.chainId,
            nonce: record.nonce,
            issuedAt: record.issuedAt,
            expiresAt: record.expiresAt,
            typedData: record.typedData,
            updatedAt: sql`now()`
          }
        })
        .returning(columns);
      if (!row) throw new Error('Writing the wallet link challenge returned no row');
      return toRecord(row);
    },

    async deletePending({ userId, address }) {
      await db
        .delete(walletLink)
        .where(and(eq(walletLink.userId, userId), eq(walletLink.address, address), eq(walletLink.status, 'pending')));
    },

    async link({ id, nonce, signature, signedAt }) {
      try {
        return await db.transaction(async (tx) => {
          const [pending] = await tx
            .select(columns)
            .from(walletLink)
            .where(and(eq(walletLink.id, id), eq(walletLink.status, 'pending'), eq(walletLink.nonce, nonce)))
            .for('update');
          if (!pending) return { outcome: 'not_pending' as const };

          // The same values WalletTracker writes; a row it already recorded is left as it is.
          await tx
            .insert(walletConnection)
            .values({ userId: pending.userId, address: pending.address, walletType: pending.walletType })
            .onConflictDoNothing({ target: [walletConnection.userId, walletConnection.address] });

          const [linked] = await tx
            .update(walletLink)
            .set({ status: 'linked', signature, signedAt, whitelistRequestedAt: signedAt, updatedAt: sql`now()` })
            .where(eq(walletLink.id, id))
            .returning(columns);
          if (!linked) return { outcome: 'not_pending' as const };
          return { outcome: 'linked' as const, record: toRecord(linked) };
        });
      } catch (error) {
        // Thrown out of the transaction so it rolls back whole: the connection row is not kept for a link that was refused.
        if (isAlreadyLinked(error)) return { outcome: 'already_linked' };
        throw error;
      }
    },

    async remove({ id, removedAt }) {
      const rows = await db
        .update(walletLink)
        .set({ status: 'removed', removedAt, updatedAt: sql`now()` })
        .where(and(eq(walletLink.id, id), eq(walletLink.status, 'linked')))
        .returning({ id: walletLink.id });
      return rows.length > 0;
    },

    async markWhitelistObserved({ id, whitelistObservedAt }) {
      const rows = await db
        .update(walletLink)
        .set({ whitelistObservedAt, updatedAt: sql`now()` })
        .where(and(eq(walletLink.id, id), eq(walletLink.status, 'linked'), isNull(walletLink.whitelistObservedAt)))
        .returning({ id: walletLink.id });
      return rows.length > 0;
    },

    async listLinked({ userId }) {
      const rows = await db
        .select(columns)
        .from(walletLink)
        .where(and(eq(walletLink.userId, userId), eq(walletLink.status, 'linked')))
        .orderBy(desc(walletLink.signedAt));
      return rows.map(toRecord);
    },

    async listAwaitingWhitelist() {
      const rows = await db
        .select(columns)
        .from(walletLink)
        .where(and(eq(walletLink.status, 'linked'), isNull(walletLink.whitelistObservedAt)))
        .orderBy(walletLink.signedAt);
      return rows.map(toRecord);
    },

    async listWhitelistObserved() {
      const rows = await db
        .select(columns)
        .from(walletLink)
        .where(and(eq(walletLink.status, 'linked'), isNotNull(walletLink.whitelistObservedAt)))
        .orderBy(walletLink.signedAt);
      return rows.map(toRecord);
    },

    async deleteExpiredPending({ expiredBefore }) {
      const rows = await db
        .delete(walletLink)
        .where(and(eq(walletLink.status, 'pending'), lt(walletLink.expiresAt, expiredBefore)))
        .returning({ id: walletLink.id });
      return rows.length;
    },

    listOtherConnectedAccounts: ({ address, exceptUserId }) =>
      db
        .select({ userId: user.id, email: user.email })
        .from(walletConnection)
        .innerJoin(user, eq(user.id, walletConnection.userId))
        .where(and(eq(walletConnection.address, address), ne(walletConnection.userId, exceptUserId)))
        .orderBy(user.email),

    async getAccount({ userId }) {
      const rows = await db
        .select({ email: user.email, name: profile.firstName })
        .from(user)
        .leftJoin(profile, eq(profile.id, user.id))
        .where(eq(user.id, userId))
        .limit(1);
      const row = rows[0];
      return row ? { email: row.email, name: row.name ?? null } : null;
    }
  };
}
