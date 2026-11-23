import 'server-only';

import { and, asc, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { type OrganizationInvitationStatus } from '@zivoe/database/organizations';
import {
  kycVerification,
  organization,
  organizationInvitation,
  organizationMember,
  organizationMemberRemoval,
  profile,
  user,
  verificationSubject
} from '@zivoe/database/schema';

import { type Db } from '@/server/clients/db';

import { type Result, err, ok } from '@/lib/result';
import { readsAsLink } from '@/lib/schemas/reads-as-link';

import {
  INVITATION_TTL_MS,
  MAX_INVITATION_SENDS,
  MAX_MEMBERS_PER_ORGANIZATION,
  MAX_ORGANIZATIONS_PER_USER,
  MAX_PENDING_INVITATIONS_PER_ORGANIZATION,
  RESEND_AFTER_MS
} from './organization-limits';

// ---------------------------------------------------------------------------
// Organizations: who belongs to what, and how they get in. One module over the
// database and two ports, so the rules below can be tested on a real Postgres.
//
// Every write that changes who is in an organization, or who has been asked,
// locks the organization's row first, so caps and "the last member" cannot race.
// Nothing here reads a session: callers pass the user the session proved, and
// the verified email is always read from the database.
// ---------------------------------------------------------------------------

/** One queued job. Self-contained and free of email addresses; delivery re-reads everything. */
export type OrganizationJob =
  | { kind: 'invitation_email'; invitationId: string; sendCount: number }
  | { kind: 'organization_created_ops'; organizationId: string }
  /** Names the `organization_member_removal` row, which delivery reads: one email per removal. */
  | { kind: 'member_removed_email'; removalId: string };

export type OrganizationOutbox = { enqueue(job: OrganizationJob): Promise<void> };

/** A job queued after its commit that could not be queued: nothing retries it, so it must be seen. */
export type ReportDroppedJob = (input: { job: OrganizationJob; error: unknown }) => void;

/** Asks the Wallet link sweep to run now, best effort: its schedule reads the same state. */
export type WalletLinkSweep = { notify(input: { subjectId: string }): Promise<void> };

export type OrganizationEmails = {
  sendInvitation(input: {
    to: string;
    invitationId: string;
    sendCount: number;
    organizationName: string;
    inviterName: string;
    inviterEmail: string | null;
    expiresAt: Date;
  }): Promise<void>;
  sendMemberRemoved(input: {
    to: string;
    name: string | null;
    organizationName: string;
    removedByName: string;
    /** One removal: what makes a retried send the same email. */
    removalKey: string;
  }): Promise<void>;
};

export type OrganizationOperatorMessages = {
  sendOrganizationCreated(input: {
    organizationId: string;
    name: string;
    countryOfIncorporation: string | null;
    /** Null once the person who created it has deleted their account. Their title is null once they have left. */
    createdBy: { name: string; email: string; title: string | null } | null;
  }): Promise<void>;
};

export type Clock = { now(): Date };

export type OrganizationDetails = {
  name: string;
  countryOfIncorporation: string;
  title: string | null;
};

export type UserOrganization = {
  id: string;
  name: string;
  countryOfIncorporation: string | null;
  title: string | null;
  joinedAt: Date;
};

export type OrganizationMemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  title: string | null;
  joinedAt: Date;
};

export type OrganizationInvitationRow = {
  id: string;
  email: string;
  status: OrganizationInvitationStatus;
  expiresAt: Date;
  lastSentAt: Date;
  sendCount: number;
  createdAt: Date;
};

export type OrganizationPage = {
  id: string;
  name: string;
  countryOfIncorporation: string | null;
  title: string | null;
  members: Array<OrganizationMemberRow>;
  invitations: Array<OrganizationInvitationRow>;
};

/** What the invited person sees once signed in with the right address; never shown to anyone else. */
export type InvitationForInvitee = {
  id: string;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string | null;
  expiresAt: Date;
};

/** The invitation page, for someone signed in (`viewForInvitee`). */
export type InvitationView =
  | { status: 'pending'; invitation: InvitationForInvitee }
  | { status: 'member'; organizationId: string }
  | { status: 'expired'; organizationName: string }
  | { status: 'other_account'; maskedEmail: string }
  | { status: 'unverified' }
  | { status: 'invalid' };

export type InviteError = {
  code:
    | 'not_member'
    | 'unverified_email'
    | 'own_email'
    | 'already_member'
    | 'already_invited'
    | 'too_many_pending'
    | 'organization_full';
};
export type ResendError = {
  code: 'not_found' | 'too_soon' | 'send_limit' | 'too_many_pending' | 'organization_full';
};
export type AcceptError = { code: 'not_found' | 'too_many_organizations' | 'organization_full' };
export type CreateOrganizationError = { code: 'too_many_organizations' };
export type LeaveError = { code: 'not_member' | 'last_member' };
export type RemoveMemberError = { code: 'not_member' | 'already_removed' | 'cannot_remove_self' };
export type DeleteOrganizationError = { code: 'not_member' | 'not_last_member' };
export type UpdateDetailsError = { code: 'not_member' | 'locked' };

/** The address the limits count by: plus-tags and Gmail's dots lead to one mailbox. */
export function canonicalEmail(email: string) {
  const [rawLocal = '', rawDomain = ''] = email.trim().toLowerCase().split('@');
  const local = rawLocal.split('+')[0] ?? '';
  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain;
  return `${domain === 'gmail.com' ? local.replaceAll('.', '') : local}@${domain}`;
}

/** An address shown to someone who may not own it: enough to recognise, not to read. */
export function maskEmail(email: string) {
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  const local = [...email.slice(0, at)];
  const shown = local.length >= 6 ? `${local.slice(0, 2).join('')}•••${local.at(-1)}` : `${local[0]}•••`;
  return `${shown}${email.slice(at)}`;
}

const displayName = (person: { firstName: string | null; lastName: string | null; userName: string }) =>
  person.firstName && person.lastName ? `${person.firstName} ${person.lastName}` : person.userName;

/**
 * An organization's name as an email to someone outside it prints it. Names typed since are checked
 * for links when written; one carried over from an older profile was not, and must not read as one.
 */
const emailSafeName = (name: string) => (readsAsLink(name) ? 'an organization' : name);

export function createOrganizations({
  db,
  outbox,
  walletLinkSweep,
  emails,
  operatorMessages,
  reportDroppedJob,
  clock
}: {
  db: Db;
  outbox: OrganizationOutbox;
  reportDroppedJob: ReportDroppedJob;
  walletLinkSweep: WalletLinkSweep;
  emails: OrganizationEmails;
  operatorMessages: OrganizationOperatorMessages;
  clock: Clock;
}) {
  type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

  /** The organization's row, locked for the transaction; null when there is none or it is deleted. */
  const lockOrganization = async (tx: Tx, organizationId: string) => {
    const [row] = await tx
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(and(eq(organization.id, organizationId), isNull(organization.deletedAt)))
      .for('update');
    return row ?? null;
  };

  const isMember = async (tx: Tx | Db, { organizationId, userId }: { organizationId: string; userId: string }) => {
    const [row] = await tx
      .select({ id: organizationMember.id })
      .from(organizationMember)
      .where(and(eq(organizationMember.organizationId, organizationId), eq(organizationMember.userId, userId)))
      .limit(1);
    return !!row;
  };

  const countMembers = async (tx: Tx, organizationId: string) => {
    const [row] = await tx
      .select({ total: count() })
      .from(organizationMember)
      .where(eq(organizationMember.organizationId, organizationId));
    return row?.total ?? 0;
  };

  /** Locks the person's row, so two tabs cannot both pass the cap, and counts the organizations they are in. */
  const countOrganizationsOf = async (tx: Tx, userId: string) => {
    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update');
    const [row] = await tx
      .select({ total: count() })
      .from(organizationMember)
      .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
      .where(and(eq(organizationMember.userId, userId), isNull(organization.deletedAt)));
    return row?.total ?? 0;
  };

  const verifiedEmailOf = async (tx: Tx | Db, userId: string) => {
    const [row] = await tx
      .select({ email: user.email, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.emailVerified ? row.email.toLowerCase() : null;
  };

  /**
   * Why one more live invitation would not fit, or null: the pending cap, and the seats left once every
   * live invitation has joined. Under the organization's lock.
   */
  const roomForOneMore = async (
    tx: Tx,
    { organizationId, live }: { organizationId: string; live: number }
  ): Promise<'too_many_pending' | 'organization_full' | null> => {
    if (live >= MAX_PENDING_INVITATIONS_PER_ORGANIZATION) return 'too_many_pending';
    if ((await countMembers(tx, organizationId)) + live >= MAX_MEMBERS_PER_ORGANIZATION) return 'organization_full';
    return null;
  };

  /** Removes a member and what hung on them: their in-flight KYB loses its starter, their open invitations end. */
  const removeMemberIn = async (tx: Tx, { organizationId, userId }: { organizationId: string; userId: string }) => {
    const now = clock.now();
    await tx
      .delete(organizationMember)
      .where(and(eq(organizationMember.organizationId, organizationId), eq(organizationMember.userId, userId)));
    // The version moves too, so a write that read the old starter loses and decides again.
    await tx
      .update(kycVerification)
      .set({ startedByUserId: null, version: sql`${kycVerification.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(kycVerification.subjectId, organizationId), eq(kycVerification.startedByUserId, userId)));
    await tx
      .update(organizationInvitation)
      .set({ status: 'cancelled', cancelledAt: now, cancelReason: 'inviter_removed' })
      .where(
        and(
          eq(organizationInvitation.organizationId, organizationId),
          eq(organizationInvitation.invitedByUserId, userId),
          eq(organizationInvitation.status, 'pending')
        )
      );
  };

  return {
    /** The organizations someone belongs to, oldest first. */
    async listForUser({ userId }: { userId: string }): Promise<Array<UserOrganization>> {
      return db
        .select({
          id: organization.id,
          name: organization.name,
          countryOfIncorporation: organization.countryOfIncorporation,
          title: organizationMember.title,
          joinedAt: organizationMember.joinedAt
        })
        .from(organizationMember)
        .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
        .where(and(eq(organizationMember.userId, userId), isNull(organization.deletedAt)))
        .orderBy(asc(organizationMember.joinedAt));
    },

    /** The newest live organization this person created and still belongs to: onboarding's invite step. */
    async latestCreatedBy({ userId }: { userId: string }): Promise<{ id: string; name: string } | null> {
      const [row] = await db
        .select({ id: organization.id, name: organization.name })
        .from(organization)
        .innerJoin(
          organizationMember,
          and(eq(organizationMember.organizationId, organization.id), eq(organizationMember.userId, userId))
        )
        .where(and(eq(organization.createdByUserId, userId), isNull(organization.deletedAt)))
        .orderBy(desc(organization.createdAt))
        .limit(1);
      return row ?? null;
    },

    /** Whether `userId` may act for this Verification subject: it is them, or an organization they belong to. */
    async canActForSubject({ userId, subjectId }: { userId: string; subjectId: string }) {
      if (subjectId === userId) return true;
      const [row] = await db
        .select({ id: organizationMember.id })
        .from(organizationMember)
        .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
        .where(
          and(
            eq(organizationMember.organizationId, subjectId),
            eq(organizationMember.userId, userId),
            isNull(organization.deletedAt)
          )
        )
        .limit(1);
      return !!row;
    },

    /** One organization for one of its members, with who is in it and who has been asked; null for anyone else. */
    async getForMember({
      organizationId,
      userId
    }: {
      organizationId: string;
      userId: string;
    }): Promise<OrganizationPage | null> {
      const [own] = await db
        .select({
          id: organization.id,
          name: organization.name,
          countryOfIncorporation: organization.countryOfIncorporation,
          title: organizationMember.title
        })
        .from(organizationMember)
        .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
        .where(
          and(
            eq(organizationMember.organizationId, organizationId),
            eq(organizationMember.userId, userId),
            isNull(organization.deletedAt)
          )
        )
        .limit(1);
      if (!own) return null;

      const [members, invitations] = await Promise.all([
        db
          .select({
            id: organizationMember.id,
            userId: organizationMember.userId,
            firstName: profile.firstName,
            lastName: profile.lastName,
            userName: user.name,
            email: user.email,
            title: organizationMember.title,
            joinedAt: organizationMember.joinedAt
          })
          .from(organizationMember)
          .innerJoin(user, eq(user.id, organizationMember.userId))
          .leftJoin(profile, eq(profile.id, user.id))
          .where(eq(organizationMember.organizationId, organizationId))
          .orderBy(asc(organizationMember.joinedAt)),
        db
          .select({
            id: organizationInvitation.id,
            email: organizationInvitation.email,
            status: organizationInvitation.status,
            expiresAt: organizationInvitation.expiresAt,
            lastSentAt: organizationInvitation.lastSentAt,
            sendCount: organizationInvitation.sendCount,
            createdAt: organizationInvitation.createdAt
          })
          .from(organizationInvitation)
          .where(
            and(eq(organizationInvitation.organizationId, organizationId), eq(organizationInvitation.status, 'pending'))
          )
          .orderBy(desc(organizationInvitation.createdAt))
      ]);

      return {
        ...own,
        members: members.map(({ firstName, lastName, userName, ...member }) => ({
          ...member,
          name: displayName({ firstName, lastName, userName })
        })),
        invitations
      };
    },

    /**
     * Creates an organization with its subject and its first member, all or nothing. `before` runs the caller's
     * own writes first, in the same transaction: onboarding saves the person's profile with their organization,
     * so neither exists without the other. It runs after the cap check, so a refusal writes nothing, and a throw
     * from it rolls everything back and reaches the caller.
     */
    async create({
      userId,
      details,
      before
    }: {
      userId: string;
      details: OrganizationDetails;
      before?: (tx: Tx) => Promise<void>;
    }): Promise<Result<{ organizationId: string }, CreateOrganizationError>> {
      const created = await db.transaction(async (tx) => {
        if ((await countOrganizationsOf(tx, userId)) >= MAX_ORGANIZATIONS_PER_USER) return null;
        await before?.(tx);
        const [row] = await tx
          .insert(organization)
          .values({
            name: details.name,
            countryOfIncorporation: details.countryOfIncorporation,
            createdByUserId: userId
          })
          .returning({ id: organization.id });
        if (!row) throw new Error('Creating the organization returned no row');
        await tx.insert(verificationSubject).values({ id: row.id, kind: 'organization', organizationId: row.id });
        await tx.insert(organizationMember).values({ organizationId: row.id, userId, title: details.title });
        return row.id;
      });
      if (!created) return err({ code: 'too_many_organizations' });

      const job = { kind: 'organization_created_ops', organizationId: created } as const;
      await outbox.enqueue(job).catch((error: unknown) => reportDroppedJob({ job, error }));
      return ok({ organizationId: created });
    },

    /**
     * Corrects the name, country and title, only until the organization has an
     * inquiry: Persona verified that name, and ops and emails trust it from then on.
     */
    async updateDetails({
      organizationId,
      userId,
      details
    }: {
      organizationId: string;
      userId: string;
      details: OrganizationDetails;
    }): Promise<Result<void, UpdateDetailsError>> {
      return db.transaction(async (tx) => {
        if (!(await lockOrganization(tx, organizationId))) return err({ code: 'not_member' as const });
        if (!(await isMember(tx, { organizationId, userId }))) return err({ code: 'not_member' as const });
        const [record] = await tx
          .select({ id: kycVerification.subjectId })
          .from(kycVerification)
          .where(eq(kycVerification.subjectId, organizationId))
          .limit(1);
        if (record) return err({ code: 'locked' as const });

        await tx
          .update(organization)
          .set({
            name: details.name,
            countryOfIncorporation: details.countryOfIncorporation,
            updatedAt: sql`now()`
          })
          .where(eq(organization.id, organizationId));
        await tx
          .update(organizationMember)
          .set({ title: details.title })
          .where(and(eq(organizationMember.organizationId, organizationId), eq(organizationMember.userId, userId)));
        return ok(undefined);
      });
    },

    /**
     * Any member but the last may leave; the last one deletes the organization
     * instead. Another member taking them out is `removeMember`, which does the same.
     */
    async leave({
      organizationId,
      userId
    }: {
      organizationId: string;
      userId: string;
    }): Promise<Result<void, LeaveError>> {
      return db.transaction(async (tx) => {
        if (!(await lockOrganization(tx, organizationId))) return err({ code: 'not_member' as const });
        if (!(await isMember(tx, { organizationId, userId }))) return err({ code: 'not_member' as const });
        if ((await countMembers(tx, organizationId)) <= 1) return err({ code: 'last_member' as const });
        await removeMemberIn(tx, { organizationId, userId });
        return ok(undefined);
      });
    },

    /**
     * Any member takes another out: there are no roles. It does what their leaving does, and
     * queues an email to them with the removal, so nobody is taken out without hearing of it
     * (a takeover by a rogue member is noticed by the people it removes). Never yourself: that
     * is leaving. Never the last member: whoever removes is a member too.
     */
    async removeMember({
      organizationId,
      actorUserId,
      userId
    }: {
      organizationId: string;
      actorUserId: string;
      userId: string;
    }): Promise<Result<void, RemoveMemberError>> {
      if (userId === actorUserId) return err({ code: 'cannot_remove_self' });
      return db.transaction(async (tx) => {
        if (!(await lockOrganization(tx, organizationId))) return err({ code: 'not_member' as const });
        if (!(await isMember(tx, { organizationId, userId: actorUserId }))) return err({ code: 'not_member' as const });
        if (!(await isMember(tx, { organizationId, userId }))) return err({ code: 'already_removed' as const });
        await removeMemberIn(tx, { organizationId, userId });
        const [removal] = await tx
          .insert(organizationMemberRemoval)
          .values({ organizationId, userId, removedByUserId: actorUserId, removedAt: clock.now() })
          .returning({ id: organizationMemberRemoval.id });
        if (!removal) throw new Error('Recording the removal returned no row');
        // In the transaction, like an invitation's: if it cannot be queued, the removal does not happen.
        await outbox.enqueue({ kind: 'member_removed_email', removalId: removal.id });
        return ok(undefined);
      });
    },

    /**
     * The last member's soft delete: it leaves every list, its invitations end and
     * it stops being a yes, so its Linked addresses are asked to revoke. Those
     * links stay, so the addresses can never be linked to another account.
     */
    async softDelete({
      organizationId,
      userId
    }: {
      organizationId: string;
      userId: string;
    }): Promise<Result<void, DeleteOrganizationError>> {
      const now = clock.now();
      const result = await db.transaction(async (tx) => {
        if (!(await lockOrganization(tx, organizationId))) return err({ code: 'not_member' as const });
        if (!(await isMember(tx, { organizationId, userId }))) return err({ code: 'not_member' as const });
        if ((await countMembers(tx, organizationId)) > 1) return err({ code: 'not_last_member' as const });
        await tx
          .update(organization)
          .set({ deletedAt: now, updatedAt: sql`now()` })
          .where(eq(organization.id, organizationId));
        await tx
          .update(organizationInvitation)
          .set({
            status: 'cancelled',
            cancelledAt: now,
            cancelledByUserId: userId,
            cancelReason: 'organization_deleted'
          })
          .where(
            and(eq(organizationInvitation.organizationId, organizationId), eq(organizationInvitation.status, 'pending'))
          );
        return ok(undefined);
      });
      if (result.ok) await walletLinkSweep.notify({ subjectId: organizationId }).catch(() => undefined);
      return result;
    },

    /**
     * Invites one address. The answer is the same whether or not the address has
     * an account. The email job is queued inside the transaction: a queue that
     * refuses leaves no invitation, and the receiver retries a job that beat the commit.
     */
    async invite({
      organizationId,
      inviterUserId,
      email
    }: {
      organizationId: string;
      inviterUserId: string;
      email: string;
    }): Promise<Result<{ invitationId: string }, InviteError>> {
      const address = email.trim().toLowerCase();
      const now = clock.now();

      return db.transaction(async (tx) => {
        if (!(await lockOrganization(tx, organizationId))) return err({ code: 'not_member' as const });
        if (!(await isMember(tx, { organizationId, userId: inviterUserId }))) {
          return err({ code: 'not_member' as const });
        }
        const inviterEmail = await verifiedEmailOf(tx, inviterUserId);
        if (!inviterEmail) return err({ code: 'unverified_email' as const });
        if (address === inviterEmail) return err({ code: 'own_email' as const });

        const [memberAlready] = await tx
          .select({ id: organizationMember.id })
          .from(organizationMember)
          .innerJoin(user, eq(user.id, organizationMember.userId))
          .where(and(eq(organizationMember.organizationId, organizationId), eq(sql`lower(${user.email})`, address)))
          .limit(1);
        if (memberAlready) return err({ code: 'already_member' as const });

        const pending = await tx
          .select({
            id: organizationInvitation.id,
            email: organizationInvitation.email,
            expiresAt: organizationInvitation.expiresAt,
            sendCount: organizationInvitation.sendCount
          })
          .from(organizationInvitation)
          .where(
            and(eq(organizationInvitation.organizationId, organizationId), eq(organizationInvitation.status, 'pending'))
          );
        const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

        // An invitation to this address already out: live is a no, expired is sent again in the same row,
        // or replaced once that row has used its sends. Either way it becomes one more live invitation, so
        // the caps come first, and a refusal leaves the old row as it was. The address's limits bound both.
        const existing = pending.find((row) => row.email === address);
        if (existing && existing.expiresAt > now) return err({ code: 'already_invited' as const });
        const full = await roomForOneMore(tx, {
          organizationId,
          live: pending.filter((row) => row.expiresAt > now).length
        });
        if (full) return err({ code: full });

        if (existing) {
          if (existing.sendCount < MAX_INVITATION_SENDS) {
            const sendCount = existing.sendCount + 1;
            await tx
              .update(organizationInvitation)
              .set({ expiresAt, lastSentAt: now, sendCount, invitedByUserId: inviterUserId })
              .where(eq(organizationInvitation.id, existing.id));
            await outbox.enqueue({ kind: 'invitation_email', invitationId: existing.id, sendCount });
            return ok({ invitationId: existing.id });
          }
          await tx
            .update(organizationInvitation)
            .set({ status: 'cancelled', cancelledAt: now, cancelledByUserId: inviterUserId, cancelReason: 'member' })
            .where(eq(organizationInvitation.id, existing.id));
        }

        const [row] = await tx
          .insert(organizationInvitation)
          .values({
            organizationId,
            email: address,
            invitedByUserId: inviterUserId,
            expiresAt,
            lastSentAt: now
          })
          .returning({ id: organizationInvitation.id });
        if (!row) throw new Error('Creating the invitation returned no row');
        await outbox.enqueue({ kind: 'invitation_email', invitationId: row.id, sendCount: 1 });
        return ok({ invitationId: row.id });
      });
    },

    /** Who a waiting invitation goes to, for one of its organization's members: what a resend's limits count by. */
    async recipientOf({
      invitationId,
      userId
    }: {
      invitationId: string;
      userId: string;
    }): Promise<{ organizationId: string; email: string } | null> {
      const [row] = await db
        .select({ organizationId: organizationInvitation.organizationId, email: organizationInvitation.email })
        .from(organizationInvitation)
        .innerJoin(
          organizationMember,
          and(
            eq(organizationMember.organizationId, organizationInvitation.organizationId),
            eq(organizationMember.userId, userId)
          )
        )
        .where(and(eq(organizationInvitation.id, invitationId), eq(organizationInvitation.status, 'pending')))
        .limit(1);
      return row ?? null;
    },

    /** Any member sends it again, a minute apart and three sends in all; the seven days start over. */
    async resend({
      invitationId,
      userId
    }: {
      invitationId: string;
      userId: string;
    }): Promise<Result<void, ResendError>> {
      const now = clock.now();
      const [invitation] = await db
        .select({ organizationId: organizationInvitation.organizationId })
        .from(organizationInvitation)
        .where(eq(organizationInvitation.id, invitationId))
        .limit(1);
      if (!invitation) return err({ code: 'not_found' });
      const { organizationId } = invitation;

      return db.transaction(async (tx) => {
        if (!(await lockOrganization(tx, organizationId))) return err({ code: 'not_found' as const });
        if (!(await isMember(tx, { organizationId, userId }))) return err({ code: 'not_found' as const });
        const [row] = await tx
          .select({
            lastSentAt: organizationInvitation.lastSentAt,
            sendCount: organizationInvitation.sendCount,
            expiresAt: organizationInvitation.expiresAt
          })
          .from(organizationInvitation)
          .where(and(eq(organizationInvitation.id, invitationId), eq(organizationInvitation.status, 'pending')))
          .for('update');
        if (!row) return err({ code: 'not_found' as const });
        if (row.sendCount >= MAX_INVITATION_SENDS) return err({ code: 'send_limit' as const });
        if (now.getTime() - row.lastSentAt.getTime() < RESEND_AFTER_MS) return err({ code: 'too_soon' as const });
        // An expired one comes back to life: it must fit, as a new one would.
        if (row.expiresAt <= now) {
          const [live] = await tx
            .select({ total: count() })
            .from(organizationInvitation)
            .where(
              and(
                eq(organizationInvitation.organizationId, organizationId),
                eq(organizationInvitation.status, 'pending'),
                gt(organizationInvitation.expiresAt, now)
              )
            );
          const full = await roomForOneMore(tx, { organizationId, live: live?.total ?? 0 });
          if (full) return err({ code: full });
        }

        const sendCount = row.sendCount + 1;
        await tx
          .update(organizationInvitation)
          // Whoever sends it again stands behind it now: the email names them, and their leaving ends it.
          .set({
            expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
            lastSentAt: now,
            sendCount,
            invitedByUserId: userId
          })
          .where(eq(organizationInvitation.id, invitationId));
        await outbox.enqueue({ kind: 'invitation_email', invitationId, sendCount });
        return ok(undefined);
      });
    },

    /** Any member may take an invitation back. */
    async cancel({
      invitationId,
      userId
    }: {
      invitationId: string;
      userId: string;
    }): Promise<Result<{ organizationId: string }, { code: 'not_found' }>> {
      const now = clock.now();
      const [invitation] = await db
        .select({ organizationId: organizationInvitation.organizationId })
        .from(organizationInvitation)
        .where(eq(organizationInvitation.id, invitationId))
        .limit(1);
      if (!invitation) return err({ code: 'not_found' });
      const { organizationId } = invitation;

      return db.transaction(async (tx) => {
        if (!(await lockOrganization(tx, organizationId))) return err({ code: 'not_found' as const });
        if (!(await isMember(tx, { organizationId, userId }))) return err({ code: 'not_found' as const });
        const rows = await tx
          .update(organizationInvitation)
          .set({ status: 'cancelled', cancelledAt: now, cancelledByUserId: userId, cancelReason: 'member' })
          .where(and(eq(organizationInvitation.id, invitationId), eq(organizationInvitation.status, 'pending')))
          .returning({ id: organizationInvitation.id });
        return rows.length > 0 ? ok({ organizationId }) : err({ code: 'not_found' as const });
      });
    },

    /**
     * What the invitation page shows this signed-in person. The invitee, once a member, is sent to
     * the organization; only the invited address's owner learns the organization's name; anyone else
     * signed in, its members included, sees the invited address masked, so they can tell which
     * account to use. Unknown and ended invitations read the same.
     */
    async viewForInvitee({ invitationId, userId }: { invitationId: string; userId: string }): Promise<InvitationView> {
      const [row] = await db
        .select({
          organizationId: organizationInvitation.organizationId,
          email: organizationInvitation.email,
          status: organizationInvitation.status,
          expiresAt: organizationInvitation.expiresAt,
          organizationName: organization.name
        })
        .from(organizationInvitation)
        .innerJoin(organization, eq(organization.id, organizationInvitation.organizationId))
        .where(and(eq(organizationInvitation.id, invitationId), isNull(organization.deletedAt)))
        .limit(1);
      if (!row) return { status: 'invalid' };
      const [account] = await db
        .select({ email: user.email, emailVerified: user.emailVerified })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      const isForThem = row.email === account?.email.toLowerCase();
      // Only the invitee is sent into the organization they joined. A member who opens someone
      // else's link (say, one they just sent) sees whose it is, as any other account does.
      if (isForThem && (await isMember(db, { organizationId: row.organizationId, userId }))) {
        return { status: 'member', organizationId: row.organizationId };
      }
      if (row.status !== 'pending') return { status: 'invalid' };
      if (!isForThem) return { status: 'other_account', maskedEmail: maskEmail(row.email) };
      // Their address, not yet proven (an X sign-in never is): a code sent to it does.
      if (!account.emailVerified) return { status: 'unverified' };
      if (row.expiresAt <= clock.now()) return { status: 'expired', organizationName: row.organizationName };
      const [invitation] = await selectInvitations(eq(organizationInvitation.id, invitationId));
      return invitation ? { status: 'pending', invitation } : { status: 'invalid' };
    },

    /** Every live invitation to this person's verified address, newest first. */
    async listForInvitee({ userId }: { userId: string }): Promise<Array<InvitationForInvitee>> {
      const email = await verifiedEmailOf(db, userId);
      if (!email) return [];
      return selectInvitations(eq(organizationInvitation.email, email));
    },

    /**
     * Joins. One transaction that re-reads everything: the invitation, the
     * organization and the verified email from the database. Running it twice
     * joins once. Every refusal that would say something about the invitation is `not_found`.
     */
    async accept({
      invitationId,
      userId
    }: {
      invitationId: string;
      userId: string;
    }): Promise<Result<{ organizationId: string }, AcceptError>> {
      const now = clock.now();
      const [found] = await db
        .select({ organizationId: organizationInvitation.organizationId })
        .from(organizationInvitation)
        .where(eq(organizationInvitation.id, invitationId))
        .limit(1);
      if (!found) return err({ code: 'not_found' });
      const { organizationId } = found;

      return db.transaction(async (tx) => {
        // The organization first, like every other write here, then the invitation.
        if (!(await lockOrganization(tx, organizationId))) return err({ code: 'not_found' as const });
        const [invitation] = await tx
          .select({
            email: organizationInvitation.email,
            status: organizationInvitation.status,
            expiresAt: organizationInvitation.expiresAt,
            acceptedByUserId: organizationInvitation.acceptedByUserId
          })
          .from(organizationInvitation)
          .where(eq(organizationInvitation.id, invitationId))
          .for('update');
        const email = await verifiedEmailOf(tx, userId);
        if (!invitation || !email || invitation.email !== email) return err({ code: 'not_found' as const });

        // Accepted already, a double click or a second tab: the same answer, nothing new. Only while they are
        // still in: an old tab replayed after they left is an ended invitation like any other.
        if (invitation.status === 'accepted' && invitation.acceptedByUserId === userId) {
          return (await isMember(tx, { organizationId, userId }))
            ? ok({ organizationId })
            : err({ code: 'not_found' as const });
        }
        if (invitation.status !== 'pending' || invitation.expiresAt <= now) return err({ code: 'not_found' as const });

        if ((await countOrganizationsOf(tx, userId)) >= MAX_ORGANIZATIONS_PER_USER) {
          return err({ code: 'too_many_organizations' as const });
        }
        if ((await countMembers(tx, organizationId)) >= MAX_MEMBERS_PER_ORGANIZATION) {
          return err({ code: 'organization_full' as const });
        }

        await tx
          .insert(organizationMember)
          .values({ organizationId, userId, invitationId, joinedAt: now })
          .onConflictDoNothing({ target: [organizationMember.organizationId, organizationMember.userId] });
        await tx
          .update(organizationInvitation)
          .set({ status: 'accepted', respondedAt: now, acceptedByUserId: userId })
          .where(eq(organizationInvitation.id, invitationId));
        return ok({ organizationId });
      });
    },

    /**
     * The invited address's owner, signed in, turns it down; an expired one too. Every other
     * refusal is `not_found`, as for accepting.
     */
    async decline({
      invitationId,
      userId
    }: {
      invitationId: string;
      userId: string;
    }): Promise<Result<{ organizationId: string }, { code: 'not_found' }>> {
      const email = await verifiedEmailOf(db, userId);
      if (!email) return err({ code: 'not_found' });
      const [found] = await db
        .select({ organizationId: organizationInvitation.organizationId })
        .from(organizationInvitation)
        .where(eq(organizationInvitation.id, invitationId))
        .limit(1);
      if (!found) return err({ code: 'not_found' });

      // Under the organization's lock, as every other invitation write: a re-invite of the same expired row
      // can't land on it in between.
      return db.transaction(async (tx) => {
        if (!(await lockOrganization(tx, found.organizationId))) return err({ code: 'not_found' as const });
        const rows = await tx
          .update(organizationInvitation)
          .set({ status: 'declined', respondedAt: clock.now() })
          .where(
            and(
              eq(organizationInvitation.id, invitationId),
              eq(organizationInvitation.email, email),
              eq(organizationInvitation.status, 'pending')
            )
          )
          .returning({ id: organizationInvitation.id });
        return rows.length > 0 ? ok({ organizationId: found.organizationId }) : err({ code: 'not_found' as const });
      });
    },

    /** The receiving half of the outbox: re-reads what the job names, then sends. `retry` when the row is not there yet. */
    async deliver({ job }: { job: OrganizationJob }): Promise<'sent' | 'skipped' | 'retry'> {
      const now = clock.now();
      switch (job.kind) {
        case 'invitation_email': {
          const inviter = alias(user, 'inviter');
          const [row] = await db
            .select({
              email: organizationInvitation.email,
              status: organizationInvitation.status,
              sendCount: organizationInvitation.sendCount,
              expiresAt: organizationInvitation.expiresAt,
              organizationName: organization.name,
              inviterEmail: inviter.email,
              firstName: profile.firstName,
              lastName: profile.lastName,
              inviterUserName: inviter.name
            })
            .from(organizationInvitation)
            .innerJoin(organization, eq(organization.id, organizationInvitation.organizationId))
            .leftJoin(inviter, eq(inviter.id, organizationInvitation.invitedByUserId))
            .leftJoin(profile, eq(profile.id, inviter.id))
            .where(eq(organizationInvitation.id, job.invitationId))
            .limit(1);
          if (!row || row.sendCount < job.sendCount) return 'retry';
          if (row.status !== 'pending' || row.sendCount > job.sendCount || row.expiresAt <= now) return 'skipped';
          const inviterName = displayName({
            firstName: row.firstName,
            lastName: row.lastName,
            userName: row.inviterUserName ?? 'A member'
          });
          // A profile saved before names were checked: the email address speaks for them instead.
          const nameReadsAsLink = readsAsLink(inviterName);
          await emails.sendInvitation({
            to: row.email,
            invitationId: job.invitationId,
            sendCount: job.sendCount,
            organizationName: emailSafeName(row.organizationName),
            inviterName: nameReadsAsLink ? (row.inviterEmail ?? 'A member') : inviterName,
            inviterEmail: nameReadsAsLink ? null : row.inviterEmail,
            expiresAt: row.expiresAt
          });
          return 'sent';
        }
        case 'member_removed_email': {
          // The job is queued before the removal commits: until its row shows, wait. A removal that
          // rolled back never shows, so it never sends (its retries end in the failure callback).
          const [removal] = await db
            .select({
              organizationId: organizationMemberRemoval.organizationId,
              userId: organizationMemberRemoval.userId,
              removedByUserId: organizationMemberRemoval.removedByUserId
            })
            .from(organizationMemberRemoval)
            .where(eq(organizationMemberRemoval.id, job.removalId))
            .limit(1);
          if (!removal) return 'retry';
          // Their account is gone since: nobody to write to.
          if (!removal.userId) return 'skipped';
          const remover = alias(user, 'remover');
          const removerProfile = alias(profile, 'remover_profile');
          const [row] = await db
            .select({
              email: user.email,
              firstName: profile.firstName,
              organizationName: organization.name,
              removerFirstName: removerProfile.firstName,
              removerLastName: removerProfile.lastName,
              removerUserName: remover.name,
              removerEmail: remover.email
            })
            .from(user)
            .leftJoin(profile, eq(profile.id, user.id))
            .innerJoin(organization, eq(organization.id, removal.organizationId))
            // A remover whose account is gone since matches nothing: the email then names nobody in particular.
            .leftJoin(remover, sql`${remover.id} = ${removal.removedByUserId}`)
            .leftJoin(removerProfile, eq(removerProfile.id, remover.id))
            .where(eq(user.id, removal.userId))
            .limit(1);
          if (!row) return 'skipped';
          const removedByName =
            displayName({
              firstName: row.removerFirstName,
              lastName: row.removerLastName,
              userName: row.removerUserName ?? ''
            }) ||
            (row.removerEmail ?? 'A member');
          await emails.sendMemberRemoved({
            to: row.email,
            name: row.firstName,
            organizationName: emailSafeName(row.organizationName),
            removedByName: readsAsLink(removedByName) ? (row.removerEmail ?? 'A member') : removedByName,
            removalKey: job.removalId
          });
          return 'sent';
        }
        case 'organization_created_ops': {
          const [row] = await db
            .select({
              name: organization.name,
              countryOfIncorporation: organization.countryOfIncorporation,
              email: user.email,
              userName: user.name,
              firstName: profile.firstName,
              lastName: profile.lastName,
              title: organizationMember.title
            })
            .from(organization)
            .leftJoin(user, eq(user.id, organization.createdByUserId))
            .leftJoin(profile, eq(profile.id, user.id))
            .leftJoin(
              organizationMember,
              and(eq(organizationMember.organizationId, organization.id), eq(organizationMember.userId, user.id))
            )
            .where(eq(organization.id, job.organizationId))
            .limit(1);
          if (!row) return 'skipped';
          const { email, userName, firstName, lastName, title, ...organizationRow } = row;
          await operatorMessages.sendOrganizationCreated({
            organizationId: job.organizationId,
            ...organizationRow,
            // An email-code sign-up has an empty account name: the email stands in when no profile names them.
            createdBy: email
              ? { name: displayName({ firstName, lastName, userName: userName ?? '' }) || email, email, title }
              : null
          });
          return 'sent';
        }
      }
    }
  };

  /** Live invitations with what the invitee reads: `where` narrows to the address, and the id for one. */
  async function selectInvitations(where: ReturnType<typeof and>): Promise<Array<InvitationForInvitee>> {
    const inviter = alias(user, 'inviter');
    const rows = await db
      .select({
        id: organizationInvitation.id,
        organizationId: organizationInvitation.organizationId,
        organizationName: organization.name,
        firstName: profile.firstName,
        lastName: profile.lastName,
        inviterUserName: inviter.name,
        inviterEmail: inviter.email,
        expiresAt: organizationInvitation.expiresAt
      })
      .from(organizationInvitation)
      .innerJoin(organization, eq(organization.id, organizationInvitation.organizationId))
      .leftJoin(inviter, eq(inviter.id, organizationInvitation.invitedByUserId))
      .leftJoin(profile, eq(profile.id, inviter.id))
      .where(
        and(
          where,
          eq(organizationInvitation.status, 'pending'),
          gt(organizationInvitation.expiresAt, clock.now()),
          isNull(organization.deletedAt)
        )
      )
      .orderBy(desc(organizationInvitation.createdAt));
    return rows.map(({ firstName, lastName, inviterUserName, inviterEmail, ...row }) => ({
      ...row,
      inviterName: displayName({ firstName, lastName, userName: inviterUserName ?? 'A member' }),
      inviterEmail
    }));
  }
}

export type Organizations = ReturnType<typeof createOrganizations>;
