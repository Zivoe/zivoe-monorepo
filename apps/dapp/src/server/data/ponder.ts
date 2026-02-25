import 'server-only';

import { and, asc, eq, gt, inArray, lte, or } from 'drizzle-orm';

import { authDb } from '@/server/clients/auth-db';
import { getPonder } from '@/server/clients/ponder';
import { deposit, redemption } from '@/server/clients/ponder/schema';
import { walletConnection } from '@/server/db/schema';

import { ApiError, handlePromise } from '@/lib/utils';

/**
 * Cursor for deterministic event progression.
 */
export type EventCursor = {
  lastBlockNumber: bigint;
  lastLogIndex: number;
};

/**
 * Get events after cursor, ordered by (blockNumber, logIndex), capped at safe block.
 */
export async function getEventsAfterCursor<T extends typeof deposit | typeof redemption>({
  table,
  tableName,
  cursor,
  safeBlockNumber,
  limit
}: {
  table: T;
  tableName: 'deposit' | 'redemption';
  cursor: EventCursor;
  safeBlockNumber: bigint;
  limit: number;
}): Promise<T['$inferSelect'][]> {
  if (!table) {
    throw new ApiError({
      message: `Missing ${tableName} table reference for monitor cursor query`,
      status: 500,
      capture: false
    });
  }

  const ponder = getPonder();

  // * SAFETY: Cast to `deposit` type because both deposit and redemption tables
  // * share identical blockNumber + logIndex columns used in the query below.
  // * If either table schema changes these columns, this cast will silently break.
  const t = table as typeof deposit;

  const { res, err } = await handlePromise(
    ponder
      .select()
      .from(t)
      .where(
        and(
          lte(t.blockNumber, safeBlockNumber),
          or(
            gt(t.blockNumber, cursor.lastBlockNumber),
            and(eq(t.blockNumber, cursor.lastBlockNumber), gt(t.logIndex, cursor.lastLogIndex))
          )
        )
      )
      .orderBy(asc(t.blockNumber), asc(t.logIndex))
      .limit(limit)
  );

  if (err) {
    throw new ApiError({
      message: `Error fetching ${tableName} events from indexer`,
      status: 500,
      exception: err,
      capture: false
    });
  }

  return res ?? [];
}

export async function hasUserDeposited(userId: string): Promise<boolean> {
  const { res: wallets, err } = await handlePromise(
    authDb
      .select({ address: walletConnection.address })
      .from(walletConnection)
      .where(eq(walletConnection.userId, userId))
  );

  if (err) {
    throw new ApiError({
      message: 'Error checking user wallets for deposits',
      status: 500,
      exception: err
    });
  }

  if (!wallets || wallets.length === 0) return false;

  const addresses = wallets.map((w) => w.address.toLowerCase());
  return hasDeposited(addresses);
}

async function hasDeposited(walletAddresses: string[]) {
  if (walletAddresses.length === 0) return false;

  const ponder = getPonder();
  const { res: deposits, err: depositsErr } = await handlePromise(
    ponder
      .select({ id: deposit.id })
      .from(deposit)
      .where(
        inArray(
          deposit.accountId,
          walletAddresses.map((a) => a.toLowerCase())
        )
      )
      .limit(1)
  );

  if (depositsErr) {
    throw new ApiError({
      message: 'Error checking wallet addresses for deposits',
      status: 500,
      exception: depositsErr
    });
  }

  return !!deposits && deposits.length > 0;
}
