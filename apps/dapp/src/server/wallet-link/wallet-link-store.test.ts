import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { type Address, type Hex } from 'viem';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as schema from '@zivoe/database/schema';

import { type Db } from '@/server/clients/db';

import { type WalletLinkRecord } from './wallet-link';
import { createPostgresWalletLinkStore } from './wallet-link-store';

// One owner per address, held by Postgres itself: the index and the trigger,
// on a real Postgres (PGlite, in process) migrated like production.

const MIGRATIONS = fileURLToPath(new URL('../../../../../packages/database/drizzle', import.meta.url));

const client = new PGlite();
const db = drizzle(client, { schema });
// The pglite driver and postgres-js build the same queries; Db names the latter.
const store = createPostgresWalletLinkStore({ db: db as unknown as Db });

const T0 = new Date('2026-10-01T10:00:00.000Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const address = (digit: string): Address => `0x${digit.repeat(40)}`;
const SIGNATURE: Hex = `0x${'ab'.repeat(65)}`;
// Opaque to the module: any version the caller checked.
const AGREEMENTS_VERSION = 'agreements-v1';

const users: Record<'ada' | 'bob' | 'cy' | 'dee', string> = { ada: '', bob: '', cy: '', dee: '' };

/** An unsigned challenge for the address. */
const challenge = ({ subjectId, on }: { subjectId: string; on: Address }) =>
  store.putPending({
    subjectId,
    signedByUserId: null,
    address: on,
    walletType: null,
    walletName: null,
    chainId: 11155111,
    status: 'pending',
    nonce: `0x${'11'.repeat(32)}`,
    issuedAt: T0,
    expiresAt: at(24 * 60),
    typedData: {} as never,
    signature: null,
    signedAt: null,
    agreementsVersion: null,
    whitelistRequestedAt: null,
    whitelistObservedAt: null,
    opsRequest: null,
    opsRequestVersion: 0
  });

/** A challenge signed through the store, the way a link is made. */
async function linked({ subjectId, on, minutes }: { subjectId: string; on: Address; minutes: number }) {
  const pending = await challenge({ subjectId, on });
  const result = await store.link({
    id: pending.id,
    nonce: pending.nonce,
    signature: SIGNATURE,
    signedAt: at(minutes),
    signedByUserId: subjectId,
    agreementsVersion: AGREEMENTS_VERSION
  });
  if (result.outcome !== 'linked') throw new Error(`Could not link ${on}: ${result.outcome}`);
  return result.record;
}

let adaOnA: WalletLinkRecord;
let cyOnC: WalletLinkRecord;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: MIGRATIONS });

  for (const name of Object.keys(users) as Array<keyof typeof users>) {
    const [row] = await db
      .insert(schema.user)
      .values({ name, email: `${name}@example.com`, createdAt: T0, updatedAt: T0 })
      .returning({ id: schema.user.id });
    users[name] = row!.id;
    await db.insert(schema.verificationSubject).values({ id: row!.id, kind: 'individual', userId: row!.id });
  }

  adaOnA = await linked({ subjectId: users.ada, on: address('a'), minutes: 10 });
  cyOnC = await linked({ subjectId: users.cy, on: address('c'), minutes: 30 });
});

afterAll(async () => {
  await client.close();
});

describe('one owner per address', () => {
  it('refuses a second account the link, by the named index', async () => {
    // Dee's challenge for C, issued before Cy's link landed.
    const pending = await challenge({ subjectId: users.dee, on: address('c') });

    await expect(
      store.link({
        id: pending.id,
        nonce: pending.nonce,
        signature: SIGNATURE,
        signedAt: at(40),
        signedByUserId: users.dee,
        agreementsVersion: AGREEMENTS_VERSION
      })
    ).resolves.toEqual({ outcome: 'address_taken' });
    // Rolled back whole: no wallet connection was kept for the refused link.
    const { rows } = await client.query(`SELECT 1 FROM wallet_connection WHERE user_id = $1`, [users.dee]);
    expect(rows).toEqual([]);
    expect(await store.getOwner({ address: address('c') })).toMatchObject({ subjectId: users.cy });
  });

  it('links a free address with its Whitelist request at version 1', async () => {
    const record = await linked({ subjectId: users.dee, on: address('d'), minutes: 50 });

    expect(record).toMatchObject({
      status: 'linked',
      opsRequest: 'whitelist',
      opsRequestVersion: 1,
      whitelistRequestedAt: at(50)
    });
    expect((await store.listAllLinked()).map((link) => link.address)).toEqual([
      address('a'),
      address('c'),
      address('d')
    ]);
  });
});

describe('signing for an organization', () => {
  it('links only while the signer is still a member of a live organization', async () => {
    const [organization] = await db
      .insert(schema.organization)
      .values({ name: 'Acme LLC', countryOfIncorporation: 'US', createdByUserId: users.bob })
      .returning({ id: schema.organization.id });
    const organizationId = organization!.id;
    await db.insert(schema.verificationSubject).values({ id: organizationId, kind: 'organization', organizationId });
    await db.insert(schema.organizationMember).values({ organizationId, userId: users.bob });
    const sign = async (on: Address, signer: string) => {
      const pending = await challenge({ subjectId: organizationId, on });
      return store.link({
        id: pending.id,
        nonce: pending.nonce,
        signature: SIGNATURE,
        signedAt: at(60),
        signedByUserId: signer,
        agreementsVersion: AGREEMENTS_VERSION
      });
    };

    // Ada was never a member: whatever she was told before, the write refuses.
    await expect(sign(address('e'), users.ada)).resolves.toEqual({ outcome: 'not_member' });
    expect((await sign(address('e'), users.bob)).outcome).toBe('linked');

    // Bob removed between the check and the write: nothing links.
    await db.delete(schema.organizationMember).where(eq(schema.organizationMember.userId, users.bob));
    await expect(sign(address('f'), users.bob)).resolves.toEqual({ outcome: 'not_member' });
    expect(await store.getOwner({ address: address('f') })).toBeNull();
  });
});

describe('what ops was asked', () => {
  it('moves only from the version read, and restarts the whitelist cycle on a Whitelist request', async () => {
    const id = cyOnC.id;
    expect(await store.markWhitelistObserved({ id, version: 1, whitelistObservedAt: at(60) })).toBe(true);

    expect(
      await store.setOpsRequest({ id, from: { opsRequest: 'whitelist', version: 1 }, to: 'revoke', at: at(70) })
    ).toBe(true);
    // A second writer that read version 1 loses.
    expect(
      await store.setOpsRequest({ id, from: { opsRequest: 'whitelist', version: 1 }, to: 'revoke', at: at(71) })
    ).toBe(false);
    // An observation read in the old cycle does not land on the new one.
    expect(await store.markWhitelistObserved({ id, version: 1, whitelistObservedAt: at(72) })).toBe(false);

    expect(
      await store.setOpsRequest({ id, from: { opsRequest: 'revoke', version: 2 }, to: 'whitelist', at: at(80) })
    ).toBe(true);
    expect(await store.get({ id })).toMatchObject({
      opsRequest: 'whitelist',
      opsRequestVersion: 3,
      whitelistRequestedAt: at(80),
      whitelistObservedAt: null
    });
  });
});

describe('the guard on signed rows', () => {
  const refused = async (statement: string, params: Array<unknown>) =>
    expect(client.query(statement, params)).rejects.toThrow(/wallet_link .*: a signed link/);

  it('never deletes a linked row, and so never its owner', async () => {
    await refused(`DELETE FROM wallet_link WHERE id = $1`, [adaOnA.id]);
    await refused(`DELETE FROM "user" WHERE id = $1`, [users.ada]);
  });

  it('never moves a Linked address out of linked, to another owner or address, or rewrites its proof', async () => {
    await refused(`UPDATE wallet_link SET status = 'pending' WHERE id = $1`, [adaOnA.id]);
    await refused(`UPDATE wallet_link SET subject_id = $2 WHERE id = $1`, [adaOnA.id, users.bob]);
    await refused(`UPDATE wallet_link SET address = $2 WHERE id = $1`, [adaOnA.id, address('e')]);
    await refused(`UPDATE wallet_link SET signature = '0x00' WHERE id = $1`, [adaOnA.id]);
  });

  it('keeps the agreements version a link was made under, and holds no linked row without one', async () => {
    expect(adaOnA.agreementsVersion).toBe(AGREEMENTS_VERSION);
    await refused(`UPDATE wallet_link SET agreements_version = '2000-01-01' WHERE id = $1`, [adaOnA.id]);

    const pending = await challenge({ subjectId: users.bob, on: address('9') });
    await expect(
      client.query(
        `UPDATE wallet_link SET status = 'linked', signature = '0x00', signed_at = now(), signed_by_user_id = $2,
           ops_request = 'whitelist', ops_request_version = 1 WHERE id = $1`,
        [pending.id, users.bob]
      )
    ).rejects.toThrow(/wallet_link_linked_has_agreements_version/);
  });

  it('lets a challenge be deleted', async () => {
    const pending = await challenge({ subjectId: users.ada, on: address('f') });

    await store.deletePending({ subjectId: users.ada, address: address('f') });

    expect(await store.get({ id: pending.id })).toBeNull();
  });
});
