import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The one migration that moves live rows: applied to a database at 0020 with
// people on it, as production will be, and refused while it would lose KYC or
// wallet rows. Statements are run by hand since the migrator cannot stop midway.

const FOLDER = fileURLToPath(new URL('../../../../../packages/database/drizzle/', import.meta.url));
const journal = JSON.parse(readFileSync(`${FOLDER}meta/_journal.json`, 'utf8')) as {
  entries: Array<{ idx: number; tag: string }>;
};

async function databaseAt0020() {
  const client = new PGlite();
  for (const { idx, tag } of journal.entries.filter((entry) => entry.idx <= 20)) {
    for (const statement of readFileSync(`${FOLDER}${tag}.sql`, 'utf8').split('--> statement-breakpoint')) {
      try {
        await client.exec(statement);
      } catch (error) {
        throw new Error(`Migration ${idx} failed: ${String(error)}`);
      }
    }
  }
  return client;
}

/** In one transaction, as the migrator runs it. */
const apply0021 = async (client: PGlite) => {
  const entry = journal.entries.find(({ idx }) => idx === 21);
  const statements = readFileSync(`${FOLDER}${entry?.tag}.sql`, 'utf8').split('--> statement-breakpoint');
  await client.transaction(async (tx) => {
    for (const statement of statements) await tx.exec(statement);
  });
};

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

async function seedUser(client: PGlite, id: string, email: string) {
  await client.query(
    `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, $3, true, now(), now())`,
    [id, email, email]
  );
}

describe('migration 0021', () => {
  it('gives every person a subject, and an organization profile its organization and first member', async () => {
    const client = await databaseAt0020();
    await seedUser(client, USER_A, 'a@example.com');
    await seedUser(client, USER_B, 'b@example.com');
    await client.query(
      `INSERT INTO profile (id, account_type, first_name, last_name, country_of_residence, amount_of_interest, how_found_zivoe)
       VALUES ($1, 'individual', 'Ada', 'A', 'GB', '10k_100k', 'other')`,
      [USER_A]
    );
    await client.query(
      `INSERT INTO profile (id, account_type, first_name, last_name, job_title, entity_name, country_of_incorporation, amount_of_interest, how_found_zivoe)
       VALUES ($1, 'organization', 'Bo', 'B', 'CFO', 'Acme LLC', 'US', '1m_5m', 'other')`,
      [USER_B]
    );

    await apply0021(client);

    const subjects = await client.query<{ id: string; kind: string; user_id: string | null }>(
      `SELECT id, kind, user_id FROM verification_subject ORDER BY kind, id`
    );
    expect(
      subjects.rows
        .filter((row) => row.kind === 'individual')
        .map((row) => row.user_id)
        .sort()
    ).toEqual([USER_A, USER_B]);
    const organizations = await client.query<{ id: string; name: string; country_of_incorporation: string }>(
      `SELECT id, name, country_of_incorporation FROM organization`
    );
    expect(organizations.rows).toMatchObject([{ name: 'Acme LLC', country_of_incorporation: 'US' }]);
    const members = await client.query<{ organization_id: string; user_id: string; title: string }>(
      `SELECT organization_id, user_id, title FROM organization_member`
    );
    expect(members.rows).toEqual([{ organization_id: organizations.rows[0]?.id, user_id: USER_B, title: 'CFO' }]);
    expect(subjects.rows.some((row) => row.id === organizations.rows[0]?.id && row.kind === 'organization')).toBe(true);
    await client.close();
  });

  it('keeps every subject tied to who it says: a person, or an organization, never neither', async () => {
    const client = await databaseAt0020();
    await seedUser(client, USER_A, 'a@example.com');
    await apply0021(client);
    const subject = (kind: string, userId: string | null) =>
      client.query(`INSERT INTO verification_subject (id, kind, user_id) VALUES ($1, $2, $3)`, [USER_A, kind, userId]);

    await expect(subject('individual', null)).rejects.toThrow(/verification_subject_is_who_it_says/);
    await expect(subject('organization', null)).rejects.toThrow(/verification_subject_is_who_it_says/);
    await expect(subject('individual', USER_A)).resolves.toBeDefined();
    await client.close();
  });

  it('refuses to run while KYC or wallet-link rows exist, and leaves the database as it was', async () => {
    const client = await databaseAt0020();
    await seedUser(client, USER_A, 'a@example.com');
    await client.query(
      `INSERT INTO kyc_verification (user_id, status, source_at, status_changed_at, last_synced_at)
       VALUES ($1, 'in_progress', now(), now(), now())`,
      [USER_A]
    );

    await expect(apply0021(client)).rejects.toThrow(/must be empty before migration 0021/);

    const tables = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'organization'`);
    expect(tables.rows).toHaveLength(0);
    await client.close();
  });
});
