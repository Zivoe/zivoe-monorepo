import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { type VerificationStatus } from '@zivoe/database/kyc';
import * as schema from '@zivoe/database/schema';

import { LATEST_AGREEMENTS_VERSION } from '@/lib/agreements';

import { getAgreementsAccess } from './agreements';

// Who the agreements gate holds, on a real Postgres (PGlite, in process) migrated like production.

const holder = vi.hoisted((): { db: unknown } => ({ db: null }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/clients/db', () => ({
  get db() {
    return holder.db;
  }
}));

const client = new PGlite();
const db = drizzle(client, { schema });
holder.db = db;
const T0 = new Date('2026-11-20T10:00:00.000Z');

let sequence = 0;
/** A person and their own subject, with their own verification at `status` when given. */
async function person({ status }: { status?: VerificationStatus } = {}) {
  sequence += 1;
  const [row] = await db
    .insert(schema.user)
    .values({ name: `p${sequence}`, email: `p${sequence}@example.com`, createdAt: T0, updatedAt: T0 })
    .returning({ id: schema.user.id });
  const id = row!.id;
  await db.insert(schema.verificationSubject).values({ id, kind: 'individual', userId: id });
  if (status) await verify({ subjectId: id, status });
  return id;
}

async function organizationOf({ members, status }: { members: Array<string>; status?: VerificationStatus }) {
  const [row] = await db
    .insert(schema.organization)
    .values({ name: `Org ${sequence}`, countryOfIncorporation: 'US', createdByUserId: members[0] })
    .returning({ id: schema.organization.id });
  const id = row!.id;
  await db.insert(schema.verificationSubject).values({ id, kind: 'organization', organizationId: id });
  for (const userId of members) await db.insert(schema.organizationMember).values({ organizationId: id, userId });
  if (status) await verify({ subjectId: id, status });
  return id;
}

const verify = ({ subjectId, status }: { subjectId: string; status: VerificationStatus }) =>
  db.insert(schema.kycVerification).values({ subjectId, status, statusChangedAt: T0, lastSyncedAt: T0 });

const accept = (userId: string, agreementsVersion = LATEST_AGREEMENTS_VERSION) =>
  db.insert(schema.agreementAcceptance).values({ userId, agreementsVersion });

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../../../packages/database/drizzle', import.meta.url))
  });
});

describe('getAgreementsAccess', () => {
  it('holds nobody who acts for no approved account, whatever they accepted', async () => {
    const newcomer = await person();
    const inReview = await person({ status: 'pending_review' });
    await accept(inReview, '2000-01-01');

    expect(await getAgreementsAccess(newcomer)).toEqual({ status: 'never', actsForApproved: false });
    expect(await getAgreementsAccess(inReview)).toEqual({ status: 'outdated', actsForApproved: false });
  });

  it('holds an approved person until they accept the version in force', async () => {
    const ada = await person({ status: 'approved' });
    expect(await getAgreementsAccess(ada)).toEqual({ status: 'never', actsForApproved: true });

    await accept(ada, '2000-01-01');
    expect(await getAgreementsAccess(ada)).toEqual({ status: 'outdated', actsForApproved: true });

    await accept(ada);
    expect(await getAgreementsAccess(ada)).toEqual({ status: 'accepted', actsForApproved: true });
  });

  it('counts a manual approval as approved, and a revoked one as not', async () => {
    expect((await getAgreementsAccess(await person({ status: 'manually_approved' }))).actsForApproved).toBe(true);
    expect((await getAgreementsAccess(await person({ status: 'revoked' }))).actsForApproved).toBe(false);
  });

  it('holds every member of an approved organization, each on their own acceptance', async () => {
    const [bob, cy] = [await person(), await person()];
    await organizationOf({ members: [bob, cy], status: 'approved' });
    await accept(bob);

    expect(await getAgreementsAccess(bob)).toEqual({ status: 'accepted', actsForApproved: true });
    expect(await getAgreementsAccess(cy)).toEqual({ status: 'never', actsForApproved: true });
  });

  it('lets go of the members of a deleted organization, and of an organization not yet approved', async () => {
    const [dee, eve] = [await person(), await person()];
    const deleted = await organizationOf({ members: [dee], status: 'approved' });
    await db.update(schema.organization).set({ deletedAt: T0 }).where(eq(schema.organization.id, deleted));
    await organizationOf({ members: [eve], status: 'submitted' });

    expect((await getAgreementsAccess(dee)).actsForApproved).toBe(false);
    expect((await getAgreementsAccess(eve)).actsForApproved).toBe(false);
  });
});
