import 'server-only';

import { and, eq, sql } from 'drizzle-orm';

import { authDb } from '@/server/clients/auth-db';
import { transactionEmailSent, transactionMonitorCursor, user, walletConnection } from '@/server/db/schema';
import type { TransactionEventType } from '@/server/db/schema';

import { ApiError, handlePromise } from '@/lib/utils';

export const FINALITY_CONFIRMATIONS = 12n;
export const EVENT_BATCH_LIMIT = 50;

export type MonitorCursor = {
  lastBlockNumber: bigint;
  lastLogIndex: number;
};

export type FailureContext = {
  eventId?: string;
  txHash?: string;
  userId?: string;
  walletAddress?: string;
  blockNumber?: bigint;
  logIndex?: number;
};

export async function getMonitorCursor(flow: TransactionEventType) {
  const { res, err } = await handlePromise(
    authDb
      .select({
        lastBlockNumber: transactionMonitorCursor.lastBlockNumber,
        lastLogIndex: transactionMonitorCursor.lastLogIndex
      })
      .from(transactionMonitorCursor)
      .where(eq(transactionMonitorCursor.flow, flow))
      .limit(1)
  );

  if (err) {
    throw new ApiError({
      message: `Failed to read cursor for ${flow} monitor`,
      status: 500,
      exception: err
    });
  }

  const cursor = res?.[0];

  if (!cursor) {
    throw new ApiError({
      message: `Missing cursor row for ${flow} monitor — run the seed migration`,
      status: 500
    });
  }

  return cursor;
}

export async function updateMonitorCursor(flow: TransactionEventType, cursor: MonitorCursor): Promise<void> {
  const { err } = await handlePromise(
    authDb
      .insert(transactionMonitorCursor)
      .values({
        flow,
        lastBlockNumber: cursor.lastBlockNumber,
        lastLogIndex: cursor.lastLogIndex,
        updatedAt: sql`now()`
      })
      .onConflictDoUpdate({
        target: transactionMonitorCursor.flow,
        set: {
          lastBlockNumber: cursor.lastBlockNumber,
          lastLogIndex: cursor.lastLogIndex,
          updatedAt: sql`now()`
        },
        // Only update if the incoming cursor is strictly ahead of the stored one.
        // Prevents cursor rewind when concurrent cron runs (e.g. QStash retries) overlap.
        setWhere: sql`excluded.last_block_number > ${transactionMonitorCursor.lastBlockNumber}
          OR (
            excluded.last_block_number = ${transactionMonitorCursor.lastBlockNumber}
            AND excluded.last_log_index > ${transactionMonitorCursor.lastLogIndex}
          )`
      })
  );

  if (err) {
    throw new ApiError({
      message: `Failed to update cursor for ${flow} monitor`,
      status: 500,
      exception: err
    });
  }
}

export async function getUsersForWallet(address: string) {
  const { res, err } = await handlePromise(
    authDb
      .select({
        userId: walletConnection.userId,
        email: user.email,
        name: user.name
      })
      .from(walletConnection)
      .innerJoin(user, eq(walletConnection.userId, user.id))
      .where(eq(walletConnection.address, address.toLowerCase()))
  );

  if (err) {
    throw new ApiError({
      message: `Failed to query users for wallet ${address.toLowerCase()}`,
      status: 500,
      exception: err
    });
  }

  return res ?? [];
}

export async function wasEmailSent({ eventId, userId }: { eventId: string; userId: string }) {
  const { res, err } = await handlePromise(
    authDb
      .select({ id: transactionEmailSent.id })
      .from(transactionEmailSent)
      .where(and(eq(transactionEmailSent.eventId, eventId), eq(transactionEmailSent.userId, userId)))
      .limit(1)
  );

  if (err) {
    throw new ApiError({
      message: 'Failed to query sent-email deduplication table',
      status: 500,
      exception: err
    });
  }

  return (res?.length ?? 0) > 0;
}

export async function recordEmailSent({
  eventId,
  txHash,
  logIndex,
  userId,
  walletAddress,
  eventType
}: {
  eventId: string;
  txHash: string;
  logIndex: number;
  userId: string;
  walletAddress: string;
  eventType: TransactionEventType;
}) {
  const { err } = await handlePromise(
    authDb
      .insert(transactionEmailSent)
      .values({
        eventId,
        txHash,
        logIndex: String(logIndex),
        userId,
        walletAddress: walletAddress.toLowerCase(),
        eventType
      })
      .onConflictDoNothing()
  );

  if (err) {
    throw new ApiError({
      message: 'Failed to record sent-email deduplication entry',
      status: 500,
      exception: err
    });
  }
}
