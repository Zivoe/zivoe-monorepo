import { PGlite } from '@electric-sql/pglite';
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

const users: Record<'ada' | 'bob' | 'cy' | 'dee', string> = { ada: '', bob: '', cy: '', dee: '' };

/** An unsigned challenge for the address. */
const challenge = ({ userId, on }: { userId: string; on: Address }) =>
  store.putPending({
    userId,
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
    whitelistRequestedAt: null,
    whitelistObservedAt: null,
    opsRequest: null,
    opsRequestVersion: 0
  });

/** A challenge signed through the store, the way a link is made. */
async function linked({ userId, on, minutes }: { userId: string; on: Address; minutes: number }) {
  const pending = await challenge({ userId, on });
  const result = await store.link({
    id: pending.id,
    nonce: pending.nonce,
    signature: SIGNATURE,
    signedAt: at(minutes)
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
  }

  adaOnA = await linked({ userId: users.ada, on: address('a'), minutes: 10 });
  cyOnC = await linked({ userId: users.cy, on: address('c'), minutes: 30 });
});

afterAll(async () => {
  await client.close();
});

describe('one owner per address', () => {
  it('refuses a second account the link, by the named index', async () => {
    // Dee's challenge for C, issued before Cy's link landed.
    const pending = await challenge({ userId: users.dee, on: address('c') });

    await expect(
      store.link({ id: pending.id, nonce: pending.nonce, signature: SIGNATURE, signedAt: at(40) })
    ).resolves.toEqual({ outcome: 'address_taken' });
    // Rolled back whole: no wallet connection was kept for the refused link.
    const { rows } = await client.query(`SELECT 1 FROM wallet_connection WHERE user_id = $1`, [users.dee]);
    expect(rows).toEqual([]);
    expect(await store.getOwner({ address: address('c') })).toMatchObject({ userId: users.cy });
  });

  it('links a free address with its Whitelist request at version 1', async () => {
    const record = await linked({ userId: users.dee, on: address('d'), minutes: 50 });

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
    await refused(`UPDATE wallet_link SET user_id = $2 WHERE id = $1`, [adaOnA.id, users.bob]);
    await refused(`UPDATE wallet_link SET address = $2 WHERE id = $1`, [adaOnA.id, address('e')]);
    await refused(`UPDATE wallet_link SET signature = '0x00' WHERE id = $1`, [adaOnA.id]);
  });

  it('lets a challenge be deleted', async () => {
    const pending = await challenge({ userId: users.ada, on: address('f') });

    await store.deletePending({ userId: users.ada, address: address('f') });

    expect(await store.get({ id: pending.id })).toBeNull();
  });
});
