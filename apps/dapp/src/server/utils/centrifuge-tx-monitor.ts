import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { eq, inArray, sql } from 'drizzle-orm';

import {
  CENTRIFUGE_CHAIN_FACTS,
  type InvestorTransactionEvent,
  fetchIndexerChainStatuses,
  fetchInvestorTransactionEventsSince,
  getShareClassIdentity
} from '@zivoe/centrifuge-indexer';
import { monitorCursor, transactionNotified, user, walletConnection } from '@zivoe/database/schema';

import { type Db, db } from '@/server/clients/db';
import { formatEmailLine, formatTelegramItem } from '@/server/utils/centrifuge-tx-alert-message';
import { sendBatchedTelegramMessages } from '@/server/utils/send-telegram';

import { ACTIVE_ENVIRONMENT, DEFAULT_CHAIN, chainOfChainId, getChainId } from '@/lib/chains';

import { env } from '@/env';

import { getChainConfig } from '@/centrifuge/config';
import { ZIVOE_VAULTS, zivoeVaultChains } from '@/zivoe-vaults';

export const CENTRIFUGE_TX_MONITOR_KEY = 'centrifuge-transactions';

/** One slug for the Sentry cron monitor AND the Sentry `flow` tag, so the two views correlate. */
export const CENTRIFUGE_TX_MONITOR_SLUG = 'centrifuge-transactions-cron';

const SENTRY_TAGS = { source: 'SERVER', flow: CENTRIFUGE_TX_MONITOR_SLUG };

/**
 * Re-read window behind the cursor. With the advance clamped to the slowest
 * chain's indexed head (below), correctness no longer rests on this — it only
 * absorbs head-timestamp granularity and clock skew around the watermark.
 * transactionNotified makes the replays free.
 */
const OVERLAP_MS = 15 * 60_000;

/**
 * The indexer has no freshness SLA, and its documented failure mode is a
 * silent stall — so staleness is itself an alert, not a log line: it raises
 * a Sentry Issue (the alerting hub; a pipeline forwards issues to the team's
 * alert channel), never a message in the transactions channel.
 */
const STALE_AFTER_MS = 30 * 60_000;

/**
 * Upper bound on events alerted in one pass. The cursor advances only past
 * what was processed, so a large backlog (post-outage catch-up) drains across
 * passes instead of failing atomically on Telegram's rate limits.
 */
const MAX_EVENTS_PER_PASS = 100;

export type CentrifugeTxMonitorResult = {
  /** True when another pass held the lock — nothing was read or sent. */
  skipped: boolean;
  bootstrapped: boolean;
  indexerStale: boolean;
  eventsSeen: number;
  notified: number;
  skippedDuplicates: number;
};

/**
 * Canonical event identity: one on-chain moment notifies once, ever. Scoped by
 * share class AND spoke chain — the pass spans several of each, and one tx can
 * legitimately carry same-type events for the same account across them. All
 * parts arrive lowercase from the indexer boundary. This is also the value a
 * future email path records in transactionEmailSent.eventId.
 */
export function buildEventId({
  scId,
  event
}: {
  scId: string;
  event: Pick<InvestorTransactionEvent, 'centrifugeId' | 'txHash' | 'type' | 'account'>;
}): string {
  return `${scId}:${event.centrifugeId}:${event.txHash}:${event.type}:${event.account}`;
}

/** One in-window event joined with everything the pass needs — identity attached exactly once. */
type AlertableEvent = {
  id: string;
  event: InvestorTransactionEvent;
  symbol: string;
  shareDecimals: number;
};

/** The transaction handle drizzle hands a `db.transaction` callback — DB, not on-chain, transaction. */
type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0];

async function readCursor({ tx, monitor }: { tx: DbTx; monitor: string }): Promise<number | undefined> {
  const rows = await tx
    .select({ lastEventAt: monitorCursor.lastEventAt })
    .from(monitorCursor)
    .where(eq(monitorCursor.monitor, monitor))
    .limit(1);
  return rows[0]?.lastEventAt;
}

async function writeCursorMonotonic({
  tx,
  monitor,
  lastEventAt
}: {
  tx: DbTx;
  monitor: string;
  lastEventAt: number;
}): Promise<void> {
  await tx
    .insert(monitorCursor)
    .values({ monitor, lastEventAt, updatedAt: sql`now()` })
    .onConflictDoUpdate({
      target: monitorCursor.monitor,
      set: { lastEventAt, updatedAt: sql`now()` },
      // Monotonic guard: a competing writer can never rewind the watermark.
      setWhere: sql`excluded.last_event_at > ${monitorCursor.lastEventAt}`
    });
}

async function readEmailsByAccount({
  tx,
  accounts
}: {
  tx: DbTx;
  accounts: Array<string>;
}): Promise<Map<string, Array<string>>> {
  const byAccount = new Map<string, Array<string>>();
  if (accounts.length === 0) return byAccount;

  // Matches because both sides are lowercased at their write boundaries:
  // trackWalletConnection lowercases on insert, the indexer query on read.
  const rows = await tx
    .select({ address: walletConnection.address, email: user.email })
    .from(walletConnection)
    .innerJoin(user, eq(walletConnection.userId, user.id))
    .where(inArray(walletConnection.address, accounts))
    // Oldest claim first, so the shown-emails cap keeps the earliest linkers
    // and the line stays stable across passes (heap order is arbitrary).
    .orderBy(walletConnection.createdAt);

  for (const row of rows) {
    const list = byAccount.get(row.address) ?? [];
    list.push(row.email);
    byAccount.set(row.address, list);
  }

  return byAccount;
}

/**
 * One polling pass, serialized by an advisory lock: freshness probe (staleness
 * reported straight to Sentry) → cursor window → fetch alertable events across
 * every live Zivoe Vault → dedupe against the notified ledger → Telegram batch
 * → record + advance the cursor, clamped to the slowest active chain's indexed
 * head so a lagging chain's back-filled events can never fall behind the
 * window. Ordering makes the pass at-least-once end to end (a crash after send
 * and before record can repeat a message; a crash anywhere never loses one).
 */
export async function runCentrifugeTransactionMonitor(): Promise<CentrifugeTxMonitorResult> {
  const now = Date.now();

  // Chains this deployment actually alerts for: where the catalog entry AND
  // the Zivoe Vault module are both live — the registry's notion of "live",
  // so a stall on an unused chain never pages anyone.
  const activeChains = [...new Set(ZIVOE_VAULTS.flatMap(zivoeVaultChains))];

  // -- Freshness probe: an unreachable or unlisted chain reads as stale, never
  // as fresh. Staleness is reported here, before the transaction, so a held
  // lock or a fetch throw downstream can never swallow the one issue that
  // matters. The slowest chain's head also bounds the cursor advance below.
  let indexerStale = false;
  let minIndexedAtMs: number | null = null;
  try {
    const statuses = await fetchIndexerChainStatuses({ environment: ACTIVE_ENVIRONMENT });
    const staleChains: Array<string> = [];
    let slowestHead = Number.POSITIVE_INFINITY;

    for (const chain of activeChains) {
      const status = statuses.get(CENTRIFUGE_CHAIN_FACTS[chain].chainId);
      if (!status) {
        staleChains.push(`${chain}: no status entry`);
        slowestHead = Number.NEGATIVE_INFINITY;
        continue;
      }
      slowestHead = Math.min(slowestHead, status.lastIndexedAtMs);
      if (now - status.lastIndexedAtMs > STALE_AFTER_MS)
        staleChains.push(
          `${chain}: last indexed block is ${Math.round((now - status.lastIndexedAtMs) / 60_000)} min old`
        );
    }

    minIndexedAtMs = Number.isFinite(slowestHead) ? slowestHead : null;
    if (staleChains.length > 0) {
      indexerStale = true;
      // Stable message on purpose — grouping keeps one Sentry issue per
      // stall; the volatile per-chain detail travels in extra.
      Sentry.captureException(new Error(`Centrifuge indexer stale on ${ACTIVE_ENVIRONMENT}`), {
        tags: SENTRY_TAGS,
        extra: { staleChains }
      });
    }
  } catch (error) {
    indexerStale = true;
    Sentry.captureException(error, { tags: SENTRY_TAGS, extra: { environment: ACTIVE_ENVIRONMENT, activeChains } });
  }

  return db.transaction(async (tx) => {
    // The transaction spans the indexer fetches and the Telegram sends (the
    // lock below must cover them, and a rollback cannot un-send a message —
    // only the record + advance are truly atomic). If the function is killed
    // mid-pass, this bounds how long the orphaned session can keep the lock.
    await tx.execute(sql`SET LOCAL idle_in_transaction_session_timeout = '60s'`);

    // Serialize passes: a QStash retry can overlap a still-running original,
    // and the dedupe read below is only correct against a settled ledger.
    const lockRows = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${CENTRIFUGE_TX_MONITOR_KEY})) AS locked`
    );
    if (lockRows[0]?.locked !== true) {
      Sentry.logger.info(`${CENTRIFUGE_TX_MONITOR_SLUG} skipped — another pass holds the lock`);
      return {
        skipped: true,
        bootstrapped: false,
        indexerStale,
        eventsSeen: 0,
        notified: 0,
        skippedDuplicates: 0
      };
    }

    // -- Cursor. First run seeds the watermark and alerts on nothing: history
    // predates the monitor and must not flood the channel at launch. Seeding
    // at the slowest indexed head (not "now") keeps events that are on-chain
    // but not yet ingested inside the first real window.
    const cursor = await readCursor({ tx, monitor: CENTRIFUGE_TX_MONITOR_KEY });
    if (cursor === undefined) {
      await writeCursorMonotonic({
        tx,
        monitor: CENTRIFUGE_TX_MONITOR_KEY,
        lastEventAt: Math.min(minIndexedAtMs ?? now, now)
      });
      return {
        skipped: false,
        bootstrapped: true,
        indexerStale,
        eventsSeen: 0,
        notified: 0,
        skippedDuplicates: 0
      };
    }

    // -- Fetch events for every live Zivoe Vault, oldest first across vaults.
    const perVault = await Promise.all(
      ZIVOE_VAULTS.map(async (zivoeVault) => {
        const identity = getShareClassIdentity({ environment: ACTIVE_ENVIRONMENT, key: zivoeVault.shareClass.key });
        const fetched = await fetchInvestorTransactionEventsSince({
          environment: ACTIVE_ENVIRONMENT,
          shareClassKey: identity.key,
          sinceMs: cursor - OVERLAP_MS
        });
        return { identity, ...fetched };
      })
    );

    const fetched: Array<AlertableEvent> = [];
    // A truncated walk is newest-first and bounded, so rows older than its
    // oldest fetched row are unreachable — by this pass and by every later
    // one, since holding the cursor never shrinks the window from the top.
    // Holding would only re-fetch the same cap forever; instead the cursor is
    // allowed to recover up to that oldest fetched row, and the skip is raised.
    let walkFloorMs = Number.POSITIVE_INFINITY;
    for (const { identity, events: classEvents, truncated, malformed } of perVault) {
      // Skipped rows are drift, not loss of the rest of the window — alarm on
      // them without letting one bad upstream row halt every alert.
      if (malformed > 0)
        Sentry.captureException(new Error('Centrifuge tx monitor skipped malformed indexer rows'), {
          tags: SENTRY_TAGS,
          extra: { shareClassKey: identity.key, malformed, environment: ACTIVE_ENVIRONMENT }
        });

      if (truncated) {
        walkFloorMs = Math.min(walkFloorMs, classEvents[0]?.createdAtMs ?? cursor);
        Sentry.captureException(
          new Error('Centrifuge tx monitor page cap hit — rows older than the walk were skipped'),
          { tags: SENTRY_TAGS, extra: { shareClassKey: identity.key, environment: ACTIVE_ENVIRONMENT } }
        );
      }

      for (const event of classEvents) {
        fetched.push({
          id: buildEventId({ scId: identity.scId, event }),
          event,
          symbol: identity.symbol,
          shareDecimals: identity.decimals
        });
      }
    }

    // -- Scope to the chains this deployment serves. The feed spans every
    // spoke the share class exists on, but only the active chains bound the
    // cursor advance below — alerting a chain outside that set could advance
    // the watermark past rows that chain has yet to index. A row the indexer
    // attached no chain to is kept: over-alerting beats losing it.
    const activeChainIds = new Set(activeChains.map(getChainId));
    const foreignChainIds = new Set<number>();
    const events = fetched.filter(({ event }) => {
      if (event.chainId === null || activeChainIds.has(event.chainId)) return true;
      foreignChainIds.add(event.chainId);
      return false;
    });
    if (foreignChainIds.size > 0)
      Sentry.captureException(new Error('Centrifuge tx monitor saw events on a chain this deployment does not serve'), {
        tags: SENTRY_TAGS,
        extra: { chainIds: [...foreignChainIds], environment: ACTIVE_ENVIRONMENT }
      });
    events.sort((a, b) => a.event.createdAtMs - b.event.createdAtMs);

    // -- Dedupe the WHOLE window against the notified ledger before capping
    // (the overlap window replays rows by design). Capping first would let
    // already-notified rows occupy the batch: a burst of more than
    // MAX_EVENTS_PER_PASS events inside one OVERLAP_MS span would then
    // re-select the same notified rows every pass, never advance, and never
    // alert again.
    const alreadyNotified = new Set(
      events.length === 0
        ? []
        : (
            await tx
              .select({ eventId: transactionNotified.eventId })
              .from(transactionNotified)
              .where(
                inArray(
                  transactionNotified.eventId,
                  events.map((row) => row.id)
                )
              )
          ).map((row) => row.eventId)
    );
    const unnotified = events.filter((row) => !alreadyNotified.has(row.id));

    // Oldest first, bounded: the remainder stays ahead of the cursor and
    // drains on the following passes.
    const capped = unnotified.length > MAX_EVENTS_PER_PASS;
    const fresh = capped ? unnotified.slice(0, MAX_EVENTS_PER_PASS) : unnotified;
    if (capped)
      Sentry.captureException(new Error('Centrifuge tx monitor backlog draining across passes'), {
        tags: SENTRY_TAGS,
        extra: { inWindow: events.length, unnotified: unnotified.length, processed: fresh.length }
      });

    const emailsByAccount = await readEmailsByAccount({
      tx,
      accounts: [...new Set(fresh.map((row) => row.event.account))]
    });
    const items = fresh.map(({ event, symbol, shareDecimals }) =>
      formatTelegramItem({
        event,
        symbol,
        shareDecimals,
        // USDC is the deposit asset on every chain; the event's own chain
        // config is its exact instance (the default chain's when the indexer
        // attached no chain).
        usdc: getChainConfig((event.chainId === null ? undefined : chainOfChainId(event.chainId)) ?? DEFAULT_CHAIN)
          .usdc,
        emailLine: formatEmailLine(emailsByAccount.get(event.account) ?? [])
      })
    );

    await sendBatchedTelegramMessages({ chatId: env.TELEGRAM_TXS_CHAT_ID, items });

    // -- Record + advance only after the send succeeded: a failed send retries
    // the whole pass instead of silently skipping events.
    if (fresh.length > 0) {
      await tx
        .insert(transactionNotified)
        .values(
          fresh.map(({ id, event }) => ({
            eventId: id,
            eventType: event.type,
            txHash: event.txHash,
            account: event.account,
            centrifugeId: event.centrifugeId,
            eventAt: event.createdAtMs
          }))
        )
        .onConflictDoNothing();
    }

    // The advance is clamped to the slowest active chain's indexed head (and
    // to the wall clock, so one future-dated row cannot poison the watermark):
    // rows a lagging chain has yet to ingest all carry `createdAt` beyond its
    // head, so they stay ahead of the cursor by construction. A capped pass
    // advances only to the last event it processed — `fresh` is oldest-first,
    // so the unprocessed remainder is newer and stays inside the window. No
    // advance when the head is unknown (probe failed / chain missing) —
    // replays are deduped, so holding still is free.
    if (minIndexedAtMs !== null) {
      const lastProcessedMs = capped ? (fresh.at(-1)?.event.createdAtMs ?? cursor) : Number.POSITIVE_INFINITY;
      const advanceTo = Math.min(minIndexedAtMs, now, lastProcessedMs, walkFloorMs);
      if (advanceTo > cursor)
        await writeCursorMonotonic({ tx, monitor: CENTRIFUGE_TX_MONITOR_KEY, lastEventAt: advanceTo });
    }

    return {
      skipped: false,
      bootstrapped: false,
      indexerStale,
      eventsSeen: events.length,
      notified: fresh.length,
      skippedDuplicates: events.length - unnotified.length
    };
  });
}
