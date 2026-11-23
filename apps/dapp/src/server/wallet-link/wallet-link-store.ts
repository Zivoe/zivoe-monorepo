import 'server-only';

import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { type Address, type Hex } from 'viem';

import {
  organization,
  organizationInvitation,
  organizationMember,
  profile,
  user,
  walletConnection,
  walletLink
} from '@zivoe/database/schema';
import { WALLET_LINK_LINKED_ADDRESS_INDEX } from '@zivoe/database/wallet-link';

import { type Db } from '@/server/clients/db';

import { type WalletLinkRecord, type WalletLinkStore } from './wallet-link';
import { type WalletLinkTypedData } from './wallet-link-typed-data';

const columns = {
  id: walletLink.id,
  subjectId: walletLink.subjectId,
  signedByUserId: walletLink.signedByUserId,
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
  agreementsVersion: walletLink.agreementsVersion,
  whitelistRequestedAt: walletLink.whitelistRequestedAt,
  whitelistObservedAt: walletLink.whitelistObservedAt,
  opsRequest: walletLink.opsRequest,
  opsRequestVersion: walletLink.opsRequestVersion
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

/** Postgres' unique_violation on the one `linked` row per address. */
const isAddressTaken = (error: unknown) => {
  const candidate = (error instanceof Error && 'cause' in error && error.cause ? error.cause : error) as {
    code?: string;
    /** postgres.js names it `constraint_name`; PGlite, which the store tests run on, `constraint`. */
    constraint_name?: string;
    constraint?: string;
  };
  return (
    candidate?.code === '23505' &&
    (candidate.constraint_name ?? candidate.constraint) === WALLET_LINK_LINKED_ADDRESS_INDEX
  );
};

/** The WalletLinkStore port over drizzle. Infrastructure failures reject, as the port allows. */
export function createPostgresWalletLinkStore({ db }: { db: Db }): WalletLinkStore {
  const one = async (where: ReturnType<typeof and>) => {
    const rows = await db.select(columns).from(walletLink).where(where).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  };

  return {
    get: ({ id }) => one(eq(walletLink.id, id)),

    getPending: ({ subjectId, address }) =>
      one(and(eq(walletLink.subjectId, subjectId), eq(walletLink.address, address), eq(walletLink.status, 'pending'))),

    getOwner: ({ address }) => one(and(eq(walletLink.address, address), eq(walletLink.status, 'linked'))),

    async putPending(record) {
      // The partial unique index on (user, address) where pending: a re-issue replaces, never piles up.
      const [row] = await db
        .insert(walletLink)
        .values(record)
        .onConflictDoUpdate({
          target: [walletLink.subjectId, walletLink.address],
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

    async deletePending({ subjectId, address }) {
      await db
        .delete(walletLink)
        .where(
          and(eq(walletLink.subjectId, subjectId), eq(walletLink.address, address), eq(walletLink.status, 'pending'))
        );
    },

    async link({ id, nonce, signature, signedAt, signedByUserId, agreementsVersion }) {
      try {
        return await db.transaction(async (tx) => {
          const [pending] = await tx
            .select(columns)
            .from(walletLink)
            .where(and(eq(walletLink.id, id), eq(walletLink.status, 'pending'), eq(walletLink.nonce, nonce)))
            .for('update');
          if (!pending) return { outcome: 'not_pending' as const };

          // Signing for an organization (a person's subject is their own id): its row locked first, then the
          // signer read as a member in a statement of its own, so it sees a removal or delete that committed
          // while this waited for the lock (one statement would keep the membership it read before waiting).
          if (pending.subjectId !== signedByUserId) {
            const [live] = await tx
              .select({ id: organization.id })
              .from(organization)
              .where(and(eq(organization.id, pending.subjectId), isNull(organization.deletedAt)))
              .for('update');
            const [member] = live
              ? await tx
                  .select({ id: organizationMember.id })
                  .from(organizationMember)
                  .where(
                    and(
                      eq(organizationMember.organizationId, pending.subjectId),
                      eq(organizationMember.userId, signedByUserId)
                    )
                  )
                  .limit(1)
              : [];
            if (!member) return { outcome: 'not_member' as const };
          }

          // The same values WalletTracker writes, for the person who signed; a row it already recorded is left as it is.
          await tx
            .insert(walletConnection)
            .values({ userId: signedByUserId, address: pending.address, walletType: pending.walletType })
            .onConflictDoNothing({ target: [walletConnection.userId, walletConnection.address] });

          const [linked] = await tx
            .update(walletLink)
            .set({
              status: 'linked',
              signedByUserId,
              signature,
              signedAt,
              agreementsVersion,
              whitelistRequestedAt: signedAt,
              opsRequest: 'whitelist',
              opsRequestVersion: 1,
              updatedAt: sql`now()`
            })
            .where(eq(walletLink.id, id))
            .returning(columns);
          if (!linked) return { outcome: 'not_pending' as const };
          return { outcome: 'linked' as const, record: toRecord(linked) };
        });
      } catch (error) {
        // Thrown out of the transaction so it rolls back whole: the connection row is not kept for a link that was refused.
        if (isAddressTaken(error)) return { outcome: 'address_taken' };
        throw error;
      }
    },

    async setOpsRequest({ id, from, to, at }) {
      const rows = await db
        .update(walletLink)
        .set({
          opsRequest: to,
          opsRequestVersion: from.version + 1,
          ...(to === 'whitelist' ? { whitelistRequestedAt: at, whitelistObservedAt: null } : {}),
          updatedAt: sql`now()`
        })
        .where(
          and(
            eq(walletLink.id, id),
            eq(walletLink.status, 'linked'),
            eq(walletLink.opsRequest, from.opsRequest),
            eq(walletLink.opsRequestVersion, from.version)
          )
        )
        .returning({ id: walletLink.id });
      return rows.length > 0;
    },

    async markWhitelistObserved({ id, version, whitelistObservedAt }) {
      const rows = await db
        .update(walletLink)
        .set({ whitelistObservedAt, updatedAt: sql`now()` })
        .where(
          and(
            eq(walletLink.id, id),
            eq(walletLink.status, 'linked'),
            eq(walletLink.opsRequest, 'whitelist'),
            eq(walletLink.opsRequestVersion, version),
            isNull(walletLink.whitelistObservedAt)
          )
        )
        .returning({ id: walletLink.id });
      return rows.length > 0;
    },

    async listLinked({ subjectId }) {
      const rows = await db
        .select(columns)
        .from(walletLink)
        .where(and(eq(walletLink.subjectId, subjectId), eq(walletLink.status, 'linked')))
        .orderBy(desc(walletLink.signedAt));
      return rows.map(toRecord);
    },

    async listAllLinked() {
      const rows = await db
        .select(columns)
        .from(walletLink)
        .where(eq(walletLink.status, 'linked'))
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

    async getOwningOrganization({ subjectId, signedByUserId }) {
      const inviter = alias(user, 'inviter');
      const [owner] = await db
        .select({ name: organization.name, deletedAt: organization.deletedAt })
        .from(organization)
        .where(eq(organization.id, subjectId))
        .limit(1);
      if (!owner) return null;

      const [signer] = signedByUserId
        ? await db
            .select({
              joinedAt: organizationMember.joinedAt,
              title: organizationMember.title,
              invitedBy: inviter.email
            })
            .from(organizationMember)
            .leftJoin(organizationInvitation, eq(organizationInvitation.id, organizationMember.invitationId))
            .leftJoin(inviter, eq(inviter.id, organizationInvitation.invitedByUserId))
            .where(and(eq(organizationMember.organizationId, subjectId), eq(organizationMember.userId, signedByUserId)))
            .limit(1)
        : [];
      return {
        name: owner.name,
        deleted: !!owner.deletedAt,
        signerJoinedAt: signer?.joinedAt ?? null,
        signerTitle: signer?.title ?? null,
        signerInvitedBy: signer?.invitedBy ?? null
      };
    },

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
