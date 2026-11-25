import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { kycVerification, user, verificationSubject } from '@zivoe/database/schema';
import * as schema from '@zivoe/database/schema';

import { type Db } from '@/server/clients/db';

import { type VerificationRecord } from './verification';
import { createPostgresVerificationStore } from './verification-store';

// The store's one rule — a write lands only on the version it read — run on a
// real Postgres (PGlite, in process) migrated like production.
const db = drizzle(new PGlite(), { schema });
// The pglite driver and postgres-js build the same queries; Db names the latter.
const store = createPostgresVerificationStore({ db: db as unknown as Db });

const T0 = new Date('2026-10-30T10:00:00.000Z');
const MINUTE = 60_000;
const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE);

let subjectId: string;

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../../../../packages/database/drizzle', import.meta.url))
  });
  const [row] = await db
    .insert(user)
    .values({ name: 'Acme', email: 'ops@acme.example', createdAt: T0, updatedAt: T0 })
    .returning({ id: user.id });
  subjectId = row!.id;
  await db.insert(verificationSubject).values({ id: subjectId, kind: 'individual', userId: subjectId });
});

beforeEach(async () => {
  await db.delete(kycVerification);
});

/** An organization approved by its KYB case at T0. */
const approved = (): VerificationRecord => ({
  subjectId,
  startedByUserId: null,
  status: 'approved',
  personaInquiryId: 'inq_1',
  personaAccountId: 'act_1',
  personaCaseId: 'case_1',
  personaCaseStatus: 'Approved',
  sourceAt: T0,
  statusChangedAt: T0,
  lastSyncedAt: T0
});

/** The same row moved back into review, as a reopen writes it. */
const inReview = (): VerificationRecord => ({
  ...approved(),
  status: 'pending_review',
  personaCaseStatus: 'Open',
  sourceAt: at(5),
  statusChangedAt: at(5),
  lastSyncedAt: at(5)
});

describe('write', () => {
  it('inserts a row at version 0, and refuses a second insert for the same user', async () => {
    await expect(store.write(approved(), { expectVersion: null })).resolves.toBe(0);
    await expect(store.write(inReview(), { expectVersion: null })).resolves.toBeNull();
    await expect(store.get({ subjectId })).resolves.toMatchObject({
      status: 'approved',
      sourceAt: T0,
      version: 0,
      subjectKind: 'individual'
    });
  });

  it('updates only the version it read, and bumps it', async () => {
    await store.write(approved(), { expectVersion: null });

    await expect(store.write(inReview(), { expectVersion: 0 })).resolves.toBe(1);
    // A writer that read version 0 lost to the one above, whatever its record says.
    await expect(store.write(approved(), { expectVersion: 0 })).resolves.toBeNull();
    await expect(store.get({ subjectId })).resolves.toMatchObject({ status: 'pending_review', version: 1 });
  });

  it('confirms a record without moving its version, so a confirmation never fails a write', async () => {
    await store.write(approved(), { expectVersion: null });

    await store.markSynced({ subjectId, syncedAt: at(10) });
    await expect(store.write(inReview(), { expectVersion: 0 })).resolves.toBe(1);
  });
});
