import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as schema from '@zivoe/database/schema';

import { type Db } from '@/server/clients/db';

import { MAX_ORGANIZATIONS_PER_USER } from './organization-limits';
import { type OrganizationJob, canonicalEmail, createOrganizations } from './organizations';

// The rules of who gets in and who stays, on a real Postgres (PGlite, in
// process) migrated like production. Only the queue and the senders are fakes.

vi.mock('server-only', () => ({}));

const client = new PGlite();
const db = drizzle(client, { schema });
const NOW = new Date('2026-11-04T10:00:00.000Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

let now = NOW;
const jobs: Array<OrganizationJob> = [];
const swept: Array<string> = [];
const emails = { sendInvitation: vi.fn(), sendMemberRemoved: vi.fn() };
const operatorMessages = { sendOrganizationCreated: vi.fn() };
const reportDroppedJob = vi.fn();
/** Set to make the queue refuse, as QStash does when it is down. */
let queueDown = false;

const organizations = createOrganizations({
  db: db as unknown as Db,
  outbox: {
    async enqueue(job) {
      if (queueDown) throw new Error('QStash is down');
      jobs.push(job);
    }
  },
  walletLinkSweep: {
    async notify({ subjectId }) {
      swept.push(subjectId);
    }
  },
  emails,
  operatorMessages,
  reportDroppedJob,
  clock: { now: () => now }
});

const DETAILS = { name: 'Acme Capital LLC', countryOfIncorporation: 'US', title: 'Partner' };

let sequence = 0;
/** A person with a profile and their subject. */
async function person({ email, verified = true }: { email?: string; verified?: boolean } = {}) {
  sequence += 1;
  const [row] = await db
    .insert(schema.user)
    .values({
      name: `Person ${sequence}`,
      email: email ?? `person${sequence}@example.com`,
      emailVerified: verified,
      createdAt: NOW,
      updatedAt: NOW
    })
    .returning({ id: schema.user.id, email: schema.user.email });
  const id = row!.id;
  await db.insert(schema.profile).values({
    id,
    firstName: 'Person',
    lastName: String(sequence),
    countryOfResidence: 'GB',
    amountOfInterest: '10k_100k',
    howFoundZivoe: 'other'
  });
  await db.insert(schema.verificationSubject).values({ id, kind: 'individual', userId: id });
  return { id, email: row!.email };
}

async function organizationOf(userId: string) {
  const created = await organizations.create({ userId, details: DETAILS });
  if (!created.ok) throw new Error(created.error.code);
  return created.value.organizationId;
}

async function invited({
  organizationId,
  inviterUserId,
  email
}: {
  organizationId: string;
  inviterUserId: string;
  email: string;
}) {
  const result = await organizations.invite({ organizationId, inviterUserId, email });
  if (!result.ok) throw new Error(result.error.code);
  return result.value.invitationId;
}

const membersOf = async (organizationId: string) =>
  db.select().from(schema.organizationMember).where(eq(schema.organizationMember.organizationId, organizationId));

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../../../packages/database/drizzle', import.meta.url))
  });
});

beforeEach(() => {
  now = NOW;
  queueDown = false;
  jobs.length = 0;
  swept.length = 0;
  vi.clearAllMocks();
});

describe('canonicalEmail', () => {
  it.each([
    ['Jane.Doe+zivoe@Gmail.com', 'janedoe@gmail.com'],
    ['jane.doe@googlemail.com', 'janedoe@gmail.com'],
    ['jane.doe+x@acme.com', 'jane.doe@acme.com']
  ])('reads %s as one mailbox', (email, canonical) => {
    expect(canonicalEmail(email)).toBe(canonical);
  });
});

describe('creating', () => {
  it('makes the organization, its subject and its first member together, and tells ops', async () => {
    const owner = await person();

    const organizationId = await organizationOf(owner.id);

    const [subject] = await db
      .select()
      .from(schema.verificationSubject)
      .where(eq(schema.verificationSubject.id, organizationId));
    expect(subject).toMatchObject({ kind: 'organization', organizationId, userId: null });
    expect(await membersOf(organizationId)).toMatchObject([{ userId: owner.id, title: 'Partner' }]);
    expect(jobs).toEqual([{ kind: 'organization_created_ops', organizationId }]);
    expect(await organizations.canActForSubject({ userId: owner.id, subjectId: organizationId })).toBe(true);
  });

  it('still creates the organization when its ops message cannot be queued, and reports the dropped job', async () => {
    const owner = await person();
    queueDown = true;

    const created = await organizations.create({ userId: owner.id, details: DETAILS });

    expect(created.ok).toBe(true);
    expect(reportDroppedJob).toHaveBeenCalledWith({
      job: { kind: 'organization_created_ops', organizationId: created.ok ? created.value.organizationId : '' },
      error: expect.any(Error)
    });
  });

  it('tells ops the organization, its country and who created it', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);

    expect(await organizations.deliver({ job: { kind: 'organization_created_ops', organizationId } })).toBe('sent');
    expect(operatorMessages.sendOrganizationCreated).toHaveBeenCalledWith({
      organizationId,
      name: DETAILS.name,
      countryOfIncorporation: DETAILS.countryOfIncorporation,
      createdBy: { name: expect.stringMatching(/^Person \d+$/), email: owner.email, title: DETAILS.title }
    });
  });

  it('names an email-code sign-up with no profile by their email', async () => {
    const owner = await person();
    await db.update(schema.user).set({ name: '' }).where(eq(schema.user.id, owner.id));
    await db.delete(schema.profile).where(eq(schema.profile.id, owner.id));
    const organizationId = await organizationOf(owner.id);

    await organizations.deliver({ job: { kind: 'organization_created_ops', organizationId } });

    expect(operatorMessages.sendOrganizationCreated).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: { name: owner.email, email: owner.email, title: DETAILS.title } })
    );
  });

  it('stops at ten organizations for one person', async () => {
    const owner = await person();
    for (let index = 0; index < MAX_ORGANIZATIONS_PER_USER; index += 1) await organizationOf(owner.id);

    expect(await organizations.create({ userId: owner.id, details: DETAILS })).toEqual({
      ok: false,
      error: { code: 'too_many_organizations' }
    });
  });

  it("commits the caller's own writes in the same transaction, as onboarding saves the profile", async () => {
    const owner = await person();

    const created = await organizations.create({
      userId: owner.id,
      details: DETAILS,
      before: async (tx) => {
        await tx.update(schema.profile).set({ firstName: 'Onboarded' }).where(eq(schema.profile.id, owner.id));
      }
    });

    expect(created.ok).toBe(true);
    const [profile] = await db.select().from(schema.profile).where(eq(schema.profile.id, owner.id));
    expect(profile?.firstName).toBe('Onboarded');
  });

  it("writes nothing when the caller's writes throw, and tells nobody", async () => {
    const owner = await person();

    await expect(
      organizations.create({
        userId: owner.id,
        details: DETAILS,
        before: async (tx) => {
          await tx.update(schema.profile).set({ firstName: 'Onboarded' }).where(eq(schema.profile.id, owner.id));
          throw new Error('already onboarded');
        }
      })
    ).rejects.toThrow('already onboarded');

    expect(await organizations.listForUser({ userId: owner.id })).toEqual([]);
    const [profile] = await db.select().from(schema.profile).where(eq(schema.profile.id, owner.id));
    expect(profile?.firstName).toBe('Person');
    expect(jobs).toEqual([]);
  });

  it('lets nobody else read it or act for it', async () => {
    const owner = await person();
    const stranger = await person();
    const organizationId = await organizationOf(owner.id);

    expect(await organizations.getForMember({ organizationId, userId: stranger.id })).toBeNull();
    expect(await organizations.canActForSubject({ userId: stranger.id, subjectId: organizationId })).toBe(false);
    expect(await organizations.invite({ organizationId, inviterUserId: stranger.id, email: 'x@example.com' })).toEqual({
      ok: false,
      error: { code: 'not_member' }
    });
  });
});

describe('details', () => {
  it('can be corrected until there is an inquiry, then not', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    const details = { ...DETAILS, name: 'Acme Holdings Ltd' };

    expect(await organizations.updateDetails({ organizationId, userId: owner.id, details })).toEqual({
      ok: true,
      value: undefined
    });

    await db.insert(schema.kycVerification).values({
      subjectId: organizationId,
      startedByUserId: owner.id,
      status: 'in_progress',
      personaInquiryId: 'inq_1',
      sourceAt: NOW,
      statusChangedAt: NOW,
      lastSyncedAt: NOW
    });
    expect(await organizations.updateDetails({ organizationId, userId: owner.id, details: DETAILS })).toEqual({
      ok: false,
      error: { code: 'locked' }
    });
    const page = await organizations.getForMember({ organizationId, userId: owner.id });
    expect(page?.name).toBe('Acme Holdings Ltd');
  });
});

describe('inviting', () => {
  it('queues the email inside the invite, and refuses an unverified inviter', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: 'Colleague@Example.com' });

    expect(jobs).toContainEqual({ kind: 'invitation_email', invitationId, sendCount: 1 });

    const unverified = await person({ verified: false });
    const theirs = await organizationOf(unverified.id);
    expect(
      await organizations.invite({ organizationId: theirs, inviterUserId: unverified.id, email: 'a@example.com' })
    ).toEqual({ ok: false, error: { code: 'unverified_email' } });
  });

  it('refuses a duplicate while live, your own address and an existing member, and sends an expired one again in the same row', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: 'dup@example.com' });

    expect(await organizations.invite({ organizationId, inviterUserId: owner.id, email: 'dup@example.com' })).toEqual({
      ok: false,
      error: { code: 'already_invited' }
    });
    expect(await organizations.invite({ organizationId, inviterUserId: owner.id, email: owner.email })).toEqual({
      ok: false,
      error: { code: 'own_email' }
    });
    const colleague = await person();
    await organizations.accept({
      invitationId: await invited({ organizationId, inviterUserId: owner.id, email: colleague.email }),
      userId: colleague.id
    });
    expect(
      await organizations.invite({ organizationId, inviterUserId: owner.id, email: colleague.email.toUpperCase() })
    ).toEqual({ ok: false, error: { code: 'already_member' } });

    now = new Date(NOW.getTime() + 8 * DAY);
    expect(await organizations.invite({ organizationId, inviterUserId: owner.id, email: 'dup@example.com' })).toEqual({
      ok: true,
      value: { invitationId }
    });
    expect(jobs).toContainEqual({ kind: 'invitation_email', invitationId, sendCount: 2 });
  });

  it('holds the caps when an expired invitation comes back, and a refusal leaves it as it was', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    const expired = await invited({ organizationId, inviterUserId: owner.id, email: 'old@example.com' });
    now = new Date(NOW.getTime() + 8 * DAY);
    for (let index = 0; index < 20; index += 1) {
      await invited({ organizationId, inviterUserId: owner.id, email: `live${index}@example.com` });
    }
    const full = { ok: false, error: { code: 'too_many_pending' } };

    expect(await organizations.invite({ organizationId, inviterUserId: owner.id, email: 'old@example.com' })).toEqual(
      full
    );
    expect(await organizations.resend({ invitationId: expired, userId: owner.id })).toEqual(full);
    const [row] = await db
      .select({ status: schema.organizationInvitation.status, sendCount: schema.organizationInvitation.sendCount })
      .from(schema.organizationInvitation)
      .where(eq(schema.organizationInvitation.id, expired));
    expect(row).toEqual({ status: 'pending', sendCount: 1 });
  });

  it('keeps a seat for every live invitation, and refuses to join a full organization', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    // 48 more members: 49 in all, one seat left.
    for (let index = 0; index < 48; index += 1) {
      const member = await person();
      await db.insert(schema.organizationMember).values({ organizationId, userId: member.id });
    }
    const last = await person();
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: last.email });

    expect(
      await organizations.invite({ organizationId, inviterUserId: owner.id, email: 'no-seat@example.com' })
    ).toEqual({ ok: false, error: { code: 'organization_full' } });

    const extra = await person();
    await db.insert(schema.organizationMember).values({ organizationId, userId: extra.id });
    expect(await organizations.accept({ invitationId, userId: last.id })).toEqual({
      ok: false,
      error: { code: 'organization_full' }
    });
  });

  it('caps what is waiting at twenty', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    for (let index = 0; index < 20; index += 1) {
      await invited({ organizationId, inviterUserId: owner.id, email: `waiting${index}@example.com` });
    }

    expect(
      await organizations.invite({ organizationId, inviterUserId: owner.id, email: 'one-more@example.com' })
    ).toEqual({
      ok: false,
      error: { code: 'too_many_pending' }
    });
  });

  it('resends a minute apart and three sends in all, starting the seven days over', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: 'again@example.com' });

    expect(await organizations.resend({ invitationId, userId: owner.id })).toEqual({
      ok: false,
      error: { code: 'too_soon' }
    });

    now = new Date(NOW.getTime() + MINUTE);
    expect((await organizations.resend({ invitationId, userId: owner.id })).ok).toBe(true);
    now = new Date(NOW.getTime() + 2 * MINUTE);
    expect((await organizations.resend({ invitationId, userId: owner.id })).ok).toBe(true);
    now = new Date(NOW.getTime() + 3 * MINUTE);
    expect(await organizations.resend({ invitationId, userId: owner.id })).toEqual({
      ok: false,
      error: { code: 'send_limit' }
    });
  });

  it('replaces an expired invitation that used all its sends, when asked again', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    const email = 'capped@example.com';
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email });
    now = new Date(NOW.getTime() + DAY);
    await organizations.resend({ invitationId, userId: owner.id });
    now = new Date(NOW.getTime() + 2 * DAY);
    await organizations.resend({ invitationId, userId: owner.id });

    now = new Date(NOW.getTime() + 30 * DAY);
    const again = await organizations.invite({ organizationId, inviterUserId: owner.id, email });

    expect(again.ok && again.value.invitationId).not.toBe(invitationId);
    expect(again.ok).toBe(true);
  });

  it('makes whoever resends the inviter, so the first inviter leaving no longer ends it', async () => {
    const first = await person();
    const second = await person();
    const organizationId = await organizationOf(first.id);
    await organizations.accept({
      invitationId: await invited({ organizationId, inviterUserId: first.id, email: second.email }),
      userId: second.id
    });
    const invitationId = await invited({ organizationId, inviterUserId: first.id, email: 'kept@example.com' });

    now = new Date(NOW.getTime() + MINUTE);
    expect((await organizations.resend({ invitationId, userId: second.id })).ok).toBe(true);
    expect((await organizations.leave({ organizationId, userId: first.id })).ok).toBe(true);

    expect(await organizations.recipientOf({ invitationId, userId: second.id })).toEqual({
      organizationId,
      email: 'kept@example.com'
    });
  });

  it('names who a waiting invitation goes to, for its members only', async () => {
    const owner = await person();
    const stranger = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: 'who@example.com' });

    expect(await organizations.recipientOf({ invitationId, userId: owner.id })).toEqual({
      organizationId,
      email: 'who@example.com'
    });
    expect(await organizations.recipientOf({ invitationId, userId: stranger.id })).toBeNull();
    await organizations.cancel({ invitationId, userId: owner.id });
    expect(await organizations.recipientOf({ invitationId, userId: owner.id })).toBeNull();
  });

  it('lets only a member resend or cancel', async () => {
    const owner = await person();
    const stranger = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: 'c@example.com' });

    expect(await organizations.cancel({ invitationId, userId: stranger.id })).toEqual({
      ok: false,
      error: { code: 'not_found' }
    });
    expect(await organizations.cancel({ invitationId, userId: owner.id })).toEqual({
      ok: true,
      value: { organizationId }
    });
  });
});

describe('onboarding', () => {
  it('finds the organization someone just created for its invite step, never one they only joined', async () => {
    const owner = await person();
    const joiner = await person();
    const organizationId = await organizationOf(owner.id);
    await organizations.accept({
      invitationId: await invited({ organizationId, inviterUserId: owner.id, email: joiner.email }),
      userId: joiner.id
    });

    expect(await organizations.latestCreatedBy({ userId: owner.id })).toEqual({
      id: organizationId,
      name: DETAILS.name
    });
    expect(await organizations.latestCreatedBy({ userId: joiner.id })).toBeNull();
  });
});

describe('accepting', () => {
  it('joins once on the invited, verified address, however many times it is pressed', async () => {
    const owner = await person();
    const invitee = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });

    expect(await organizations.accept({ invitationId, userId: invitee.id })).toEqual({
      ok: true,
      value: { organizationId }
    });
    expect(await organizations.accept({ invitationId, userId: invitee.id })).toEqual({
      ok: true,
      value: { organizationId }
    });

    expect(await membersOf(organizationId)).toHaveLength(2);
    expect(await organizations.viewForInvitee({ invitationId, userId: invitee.id })).toEqual({
      status: 'member',
      organizationId
    });

    // Replayed from an old tab after leaving: an ended invitation, not "you joined".
    await organizations.leave({ organizationId, userId: invitee.id });
    expect(await organizations.accept({ invitationId, userId: invitee.id })).toEqual({
      ok: false,
      error: { code: 'not_found' }
    });
    expect(await membersOf(organizationId)).toHaveLength(1);
  });

  it('refuses the wrong account, an unverified one, an expired or a cancelled invitation alike', async () => {
    const owner = await person();
    const invitee = await person();
    const organizationId = await organizationOf(owner.id);
    const notFound = { ok: false, error: { code: 'not_found' } };

    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });
    const wrong = await person();
    expect(await organizations.accept({ invitationId, userId: wrong.id })).toEqual(notFound);

    const unverified = await person({ verified: false });
    const forUnverified = await invited({ organizationId, inviterUserId: owner.id, email: unverified.email });
    expect(await organizations.accept({ invitationId: forUnverified, userId: unverified.id })).toEqual(notFound);

    now = new Date(NOW.getTime() + 8 * DAY);
    expect(await organizations.accept({ invitationId, userId: invitee.id })).toEqual(notFound);

    now = NOW;
    await organizations.cancel({ invitationId, userId: owner.id });
    expect(await organizations.accept({ invitationId, userId: invitee.id })).toEqual(notFound);
    expect(await organizations.accept({ invitationId: crypto.randomUUID(), userId: invitee.id })).toEqual(notFound);
    expect(await membersOf(organizationId)).toHaveLength(1);
  });

  it('shows the invitee what they were asked to join, and lists it for their address only', async () => {
    const owner = await person();
    const invitee = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });

    expect(await organizations.viewForInvitee({ invitationId, userId: invitee.id })).toMatchObject({
      status: 'pending',
      invitation: { organizationId, organizationName: DETAILS.name, inviterEmail: owner.email }
    });
    expect(await organizations.listForInvitee({ userId: invitee.id })).toHaveLength(1);
    expect(await organizations.listForInvitee({ userId: owner.id })).toHaveLength(0);
  });

  it('names the organization to the invited address only; anyone else sees the address masked', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: 'janedoe@example.com' });
    const wrong = await person();
    const unverified = await person({ verified: false });

    const masked = { status: 'other_account', maskedEmail: 'ja•••e@example.com' };
    expect(await organizations.viewForInvitee({ invitationId, userId: wrong.id })).toEqual(masked);
    expect(await organizations.viewForInvitee({ invitationId, userId: unverified.id })).toEqual(masked);
    // Their own address, unproven: told to prove it, not that it is someone else's.
    const forUnverified = await invited({ organizationId, inviterUserId: owner.id, email: unverified.email });
    expect(await organizations.viewForInvitee({ invitationId: forUnverified, userId: unverified.id })).toEqual({
      status: 'unverified'
    });
    // A member opening a link they sent is not sent into the organization as if it had worked.
    expect(await organizations.viewForInvitee({ invitationId, userId: owner.id })).toEqual(masked);
    now = new Date(NOW.getTime() + 8 * DAY);
    expect(await organizations.viewForInvitee({ invitationId, userId: owner.id })).toEqual(masked);
  });

  it('shows a member an answered invitation as ended, and sends only its invitee in', async () => {
    const owner = await person();
    const invitee = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });
    await organizations.accept({ invitationId, userId: invitee.id });

    expect(await organizations.viewForInvitee({ invitationId, userId: owner.id })).toEqual({ status: 'invalid' });
    expect(await organizations.viewForInvitee({ invitationId, userId: invitee.id })).toEqual({
      status: 'member',
      organizationId
    });
  });

  it('tells its owner an invitation expired, and reads unknown and ended ones the same', async () => {
    const owner = await person();
    const invitee = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });

    now = new Date(NOW.getTime() + 8 * DAY);
    expect(await organizations.viewForInvitee({ invitationId, userId: invitee.id })).toEqual({
      status: 'expired',
      organizationName: DETAILS.name
    });

    now = NOW;
    await organizations.cancel({ invitationId, userId: owner.id });
    const invalid = { status: 'invalid' };
    expect(await organizations.viewForInvitee({ invitationId, userId: invitee.id })).toEqual(invalid);
    expect(await organizations.viewForInvitee({ invitationId: crypto.randomUUID(), userId: invitee.id })).toEqual(
      invalid
    );
  });
});

describe('declining', () => {
  it('ends the invitation for its signed-in owner, and the organization may ask again later', async () => {
    const owner = await person();
    const invitee = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });

    expect(await organizations.decline({ invitationId, userId: invitee.id })).toEqual({
      ok: true,
      value: { organizationId }
    });

    expect(await organizations.viewForInvitee({ invitationId, userId: invitee.id })).toEqual({ status: 'invalid' });
    expect((await organizations.invite({ organizationId, inviterUserId: owner.id, email: invitee.email })).ok).toBe(
      true
    );
  });

  it('declines an expired invitation too', async () => {
    const owner = await person();
    const invitee = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });

    now = new Date(NOW.getTime() + 8 * DAY);
    expect((await organizations.decline({ invitationId, userId: invitee.id })).ok).toBe(true);
  });

  it('refuses once the organization is deleted', async () => {
    const owner = await person();
    const invitee = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });
    await organizations.softDelete({ organizationId, userId: owner.id });

    expect(await organizations.decline({ invitationId, userId: invitee.id })).toEqual({
      ok: false,
      error: { code: 'not_found' }
    });
  });

  it('refuses anyone else, an unverified owner, an unknown id or one already accepted', async () => {
    const owner = await person();
    const invitee = await person();
    const unverified = await person({ verified: false });
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: invitee.email });
    const forUnverified = await invited({ organizationId, inviterUserId: owner.id, email: unverified.email });
    const notFound = { ok: false, error: { code: 'not_found' } };

    expect(await organizations.decline({ invitationId, userId: owner.id })).toEqual(notFound);
    expect(await organizations.decline({ invitationId: forUnverified, userId: unverified.id })).toEqual(notFound);
    expect(await organizations.decline({ invitationId: crypto.randomUUID(), userId: invitee.id })).toEqual(notFound);

    await organizations.accept({ invitationId, userId: invitee.id });
    expect(await organizations.decline({ invitationId, userId: invitee.id })).toEqual(notFound);
    expect(await membersOf(organizationId)).toHaveLength(2);
  });
});

describe('leaving', () => {
  it('clears their in-flight verification and ends the invitations they sent, but never the last member', async () => {
    const owner = await person();
    const second = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: second.email });
    await organizations.accept({ invitationId, userId: second.id });
    const waiting = await invited({ organizationId, inviterUserId: second.id, email: 'theirs@example.com' });
    await db.insert(schema.kycVerification).values({
      subjectId: organizationId,
      startedByUserId: second.id,
      status: 'in_progress',
      personaInquiryId: 'inq_2',
      sourceAt: NOW,
      statusChangedAt: NOW,
      lastSyncedAt: NOW
    });

    expect((await organizations.leave({ organizationId, userId: second.id })).ok).toBe(true);

    const [record] = await db
      .select()
      .from(schema.kycVerification)
      .where(eq(schema.kycVerification.subjectId, organizationId));
    expect(record).toMatchObject({ startedByUserId: null, version: 1 });
    const [invitation] = await db
      .select()
      .from(schema.organizationInvitation)
      .where(eq(schema.organizationInvitation.id, waiting));
    expect(invitation).toMatchObject({ status: 'cancelled', cancelReason: 'inviter_removed' });
    expect(await organizations.canActForSubject({ userId: second.id, subjectId: organizationId })).toBe(false);

    expect(await organizations.leave({ organizationId, userId: owner.id })).toEqual({
      ok: false,
      error: { code: 'last_member' }
    });
  });
});

describe('removing a member', () => {
  /** Two members: the owner, and a second who joined by invitation. */
  async function team() {
    const owner = await person();
    const second = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: second.email });
    await organizations.accept({ invitationId, userId: second.id });
    jobs.length = 0;
    return { owner, second, organizationId };
  }

  it('lets any member take another out, as their leaving would, records who did, and queues an email to them', async () => {
    const { owner, second, organizationId } = await team();
    const ownersInvitation = await invited({
      organizationId,
      inviterUserId: owner.id,
      email: 'owner-sent@example.com'
    });
    const secondsInvitation = await invited({
      organizationId,
      inviterUserId: second.id,
      email: 'second-sent@example.com'
    });
    jobs.length = 0;

    expect(await organizations.removeMember({ organizationId, actorUserId: second.id, userId: owner.id })).toEqual({
      ok: true,
      value: undefined
    });

    expect(await organizations.canActForSubject({ userId: owner.id, subjectId: organizationId })).toBe(false);
    const [removal] = await db.select().from(schema.organizationMemberRemoval);
    expect(removal).toMatchObject({ organizationId, userId: owner.id, removedByUserId: second.id });
    expect(jobs).toEqual([{ kind: 'member_removed_email', removalId: removal?.id }]);
    // The removed person's waiting invitations end; the remaining member's stay.
    const statusOf = async (id: string) =>
      (await db.select().from(schema.organizationInvitation).where(eq(schema.organizationInvitation.id, id)))[0];
    expect(await statusOf(ownersInvitation)).toMatchObject({ status: 'cancelled', cancelReason: 'inviter_removed' });
    expect((await statusOf(secondsInvitation))?.status).toBe('pending');
  });

  it('refuses yourself, someone already out, and anyone who is not a member', async () => {
    const { owner, second, organizationId } = await team();
    const stranger = await person();

    expect(await organizations.removeMember({ organizationId, actorUserId: owner.id, userId: owner.id })).toEqual({
      ok: false,
      error: { code: 'cannot_remove_self' }
    });
    expect(await organizations.removeMember({ organizationId, actorUserId: stranger.id, userId: second.id })).toEqual({
      ok: false,
      error: { code: 'not_member' }
    });
    expect(await organizations.removeMember({ organizationId, actorUserId: owner.id, userId: stranger.id })).toEqual({
      ok: false,
      error: { code: 'already_removed' }
    });
    expect(await membersOf(organizationId)).toHaveLength(2);
    expect(jobs).toEqual([]);
  });

  it('does not remove anyone when the email cannot be queued', async () => {
    const { owner, second, organizationId } = await team();
    queueDown = true;

    await expect(
      organizations.removeMember({ organizationId, actorUserId: owner.id, userId: second.id })
    ).rejects.toThrow();

    expect(await membersOf(organizationId)).toHaveLength(2);
  });

  it('emails the removed person who removed them, once the removal has committed', async () => {
    const { owner, second, organizationId } = await team();
    await organizations.removeMember({ organizationId, actorUserId: owner.id, userId: second.id });
    const job = jobs.find((candidate) => candidate.kind === 'member_removed_email');
    if (!job) throw new Error('no job');

    expect(await organizations.deliver({ job })).toBe('sent');
    expect(emails.sendMemberRemoved).toHaveBeenCalledWith({
      to: second.email,
      name: 'Person',
      organizationName: DETAILS.name,
      removedByName: expect.stringMatching(/^Person \d+$/),
      removalKey: job.kind === 'member_removed_email' ? job.removalId : ''
    });
  });

  it('waits for a removal that has not committed, and so never sends for one that rolled back', async () => {
    expect(await organizations.deliver({ job: { kind: 'member_removed_email', removalId: crypto.randomUUID() } })).toBe(
      'retry'
    );
    expect(emails.sendMemberRemoved).not.toHaveBeenCalled();
  });
});

describe('deleting', () => {
  it('is for the last member, ends its invitations, leaves every list and asks the wallet sweep', async () => {
    const owner = await person();
    const second = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: second.email });
    await organizations.accept({ invitationId, userId: second.id });
    const waiting = await invited({ organizationId, inviterUserId: owner.id, email: 'w@example.com' });

    expect(await organizations.softDelete({ organizationId, userId: owner.id })).toEqual({
      ok: false,
      error: { code: 'not_last_member' }
    });
    await organizations.leave({ organizationId, userId: second.id });

    expect((await organizations.softDelete({ organizationId, userId: owner.id })).ok).toBe(true);

    expect(swept).toEqual([organizationId]);
    expect(await organizations.listForUser({ userId: owner.id })).toEqual([]);
    expect(await organizations.getForMember({ organizationId, userId: owner.id })).toBeNull();
    expect(await organizations.canActForSubject({ userId: owner.id, subjectId: organizationId })).toBe(false);
    const [invitation] = await db
      .select()
      .from(schema.organizationInvitation)
      .where(eq(schema.organizationInvitation.id, waiting));
    expect(invitation).toMatchObject({ status: 'cancelled', cancelReason: 'organization_deleted' });
  });
});

describe('delivering', () => {
  it("never prints an organization name that reads as a link, as an older profile's may", async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    await db
      .update(schema.organization)
      .set({ name: 'Acme, claim at acme-airdrop.io' })
      .where(eq(schema.organization.id, organizationId));
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: 'e@example.com' });

    await organizations.deliver({ job: { kind: 'invitation_email', invitationId, sendCount: 1 } });

    expect(emails.sendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationName: 'an organization' })
    );
  });

  it('sends the invitation that is still live, skips an outdated one, retries one that beat its row', async () => {
    const owner = await person();
    const organizationId = await organizationOf(owner.id);
    const invitationId = await invited({ organizationId, inviterUserId: owner.id, email: 'd@example.com' });
    const job: OrganizationJob = { kind: 'invitation_email', invitationId, sendCount: 1 };

    expect(await organizations.deliver({ job })).toBe('sent');
    expect(emails.sendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'd@example.com', organizationName: DETAILS.name, inviterEmail: owner.email })
    );

    expect(await organizations.deliver({ job: { ...job, sendCount: 2 } })).toBe('retry');

    await organizations.cancel({ invitationId, userId: owner.id });
    expect(await organizations.deliver({ job })).toBe('skipped');
  });
});
