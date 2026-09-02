import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { eq, inArray, sql } from 'drizzle-orm';

import {
  type InvestorTransactionEvent,
  fetchIndexerChainStatuses,
  fetchInvestorTransactionEventsSince,
  getShareClassIdentity
} from '@zivoe/centrifuge-indexer';
import { monitorCursor, transactionNotified, user, walletConnection } from '@zivoe/database/schema';

import { type Db, db } from '@/server/clients/db';
import { qstash } from '@/server/clients/qstash';
import { BASE_URL } from '@/server/utils/base-url';
import { formatEmailLine, formatTelegramItem } from '@/server/utils/centrifuge-tx-alert-message';
import {
  TRANSACTION_RECEIPT_JOB_PATH,
  type TransactionReceiptJobInput,
  buildReceiptJobKey
} from '@/server/utils/centrifuge-tx-receipt-job';
import { sendBatchedTelegramMessages } from '@/server/utils/send-telegram';

import { ACTIVE_ENVIRONMENT, getChainId } from '@/lib/chains';
import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';
import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

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

/**
 * Collective budget for ALL indexer I/O in one pass (status probe + every
 * page walk shares one signal). Without it the worst case — five slow pages
 * per Zivoe Vault at the fetch layer's 10s each — spends the route's whole
 * 60s before the first Telegram send, and a pass killed mid-send is exactly
 * the sent-but-unrecorded window the ledger ordering tries to keep small.
 */
const INDEXER_IO_DEADLINE_MS = 30_000;

/** QStash's batch endpoint cap — passes near MAX_EVENTS_PER_PASS can exceed it across linked users. */
const QSTASH_BATCH_LIMIT = 100;

export type CentrifugeTxMonitorResult = {
  /** True when another pass held the lock — nothing was read or sent. */
  skipped: boolean;
  bootstrapped: boolean;
  indexerStale: boolean;
  eventsSeen: number;
  notified: number;
  skippedDuplicates: number;
  /** Receipt Mailer jobs published this pass — one per (event, linked user). */
  emailJobsEnqueued: number;
};

/** A pass that read and sent nothing — early exits spread this and flip their one flag. */
const EMPTY_PASS = {
  skipped: false,
  bootstrapped: false,
  indexerStale: false,
  eventsSeen: 0,
  notified: 0,
  skippedDuplicates: 0,
  emailJobsEnqueued: 0
} satisfies CentrifugeTxMonitorResult;

/**
 * Canonical event identity: one on-chain moment notifies once, ever. Scoped by
 * share class AND spoke chain — the pass spans several of each, and one tx can
 * legitimately carry same-type events for the same account across them. All
 * parts arrive lowercase from the indexer boundary. This is also the value
 * the Receipt Mailer records in transactionEmailSent.eventId.
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
  shareClassKey: string;
  vaultSlug: string;
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

type LinkedUser = { userId: string; email: string };

async function readLinkedUsersByAccount({
  tx,
  accounts
}: {
  tx: DbTx;
  accounts: Array<string>;
}): Promise<Map<string, Array<LinkedUser>>> {
  const byAccount = new Map<string, Array<LinkedUser>>();
  if (accounts.length === 0) return byAccount;

  // Matches because both sides are lowercased at their write boundaries:
  // trackWalletConnection lowercases on insert, the indexer query on read.
  const rows = await tx
    .select({ address: walletConnection.address, userId: walletConnection.userId, email: user.email })
    .from(walletConnection)
    .innerJoin(user, eq(walletConnection.userId, user.id))
    .where(inArray(walletConnection.address, accounts))
    // Oldest claim first, so the shown-emails cap keeps the earliest linkers
    // and the line stays stable across passes (heap order is arbitrary).
    .orderBy(walletConnection.createdAt);

  for (const row of rows) {
    const list = byAccount.get(row.address) ?? [];
    list.push({ userId: row.userId, email: row.email });
    byAccount.set(row.address, list);
  }

  return byAccount;
}

/**
 * One polling pass, serialized by an advisory lock: freshness probe (staleness
 * reported straight to Sentry) → cursor window → fetch alertable events across
 * every live Zivoe Vault → dedupe against the notified ledger → Telegram batch
 * → enqueue Receipt Mailer jobs per (event, linked user)
 * → record + advance the cursor, clamped to the slowest active chain's indexed
 * head so a lagging chain's back-filled events can never fall behind the
 * window. Ordering makes the pass at-least-once end to end (a crash after send
 * and before record can repeat a message; a crash anywhere never loses one).
 */
export async function runCentrifugeTransactionMonitor(): Promise<CentrifugeTxMonitorResult> {
  const now = Date.now();
  const indexerSignal = AbortSignal.timeout(INDEXER_IO_DEADLINE_MS);

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
  const { res: statuses, err: probeErr } = await handlePromise(
    fetchIndexerChainStatuses({ environment: ACTIVE_ENVIRONMENT, fetchOptions: { signal: indexerSignal } })
  );
  if (statuses === undefined) {
    indexerStale = true;
    Sentry.captureException(probeErr, { tags: SENTRY_TAGS, extra: { environment: ACTIVE_ENVIRONMENT, activeChains } });
  } else {
    // `minutesOld: null` means the chain has no status entry at all — what a
    // stalled or re-syncing instance looks like. Block numbers ride along so
    // an operator can pin the stall without querying the indexer by hand.
    const staleChains: Array<{ chain: string; minutesOld: number | null; blockNumber: number | null }> = [];
    let slowestHead = Number.POSITIVE_INFINITY;

    for (const chain of activeChains) {
      const status = statuses.get(getChainId(chain));
      if (!status) {
        staleChains.push({ chain, minutesOld: null, blockNumber: null });
        slowestHead = Number.NEGATIVE_INFINITY;
        continue;
      }
      slowestHead = Math.min(slowestHead, status.lastIndexedAtMs);
      if (now - status.lastIndexedAtMs > STALE_AFTER_MS)
        staleChains.push({
          chain,
          minutesOld: Math.round((now - status.lastIndexedAtMs) / 60_000),
          blockNumber: status.blockNumber
        });
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
      return { ...EMPTY_PASS, skipped: true, indexerStale };
    }

    // -- Cursor. First run seeds the watermark and alerts on nothing: history
    // predates the monitor and must not flood the channel at launch. Seeding
    // at the slowest indexed head (not "now") keeps events that are on-chain
    // but not yet ingested inside the first real window. A stale or unknown
    // head refuses to seed at all — a lagging head would plant the watermark
    // in the past and replay that history as new, and an unknown one would
    // seed at "now" and lose the un-ingested gap for good. Next pass retries.
    const cursor = await readCursor({ tx, monitor: CENTRIFUGE_TX_MONITOR_KEY });
    if (cursor === undefined) {
      if (indexerStale || minIndexedAtMs === null) return { ...EMPTY_PASS, indexerStale };

      await writeCursorMonotonic({
        tx,
        monitor: CENTRIFUGE_TX_MONITOR_KEY,
        lastEventAt: Math.min(minIndexedAtMs, now)
      });
      return { ...EMPTY_PASS, bootstrapped: true, indexerStale };
    }

    // -- Fetch events for every live Zivoe Vault, oldest first across Zivoe Vaults.
    const perZivoeVault = await Promise.all(
      ZIVOE_VAULTS.map(async (zivoeVault) => {
        const identity = getShareClassIdentity({ environment: ACTIVE_ENVIRONMENT, key: zivoeVault.shareClass.key });
        const walk = await fetchInvestorTransactionEventsSince({
          environment: ACTIVE_ENVIRONMENT,
          shareClassKey: identity.key,
          sinceMs: cursor - OVERLAP_MS,
          fetchOptions: { signal: indexerSignal }
        });
        return { identity, vaultSlug: zivoeVault.slug, ...walk };
      })
    );

    const fetched: Array<AlertableEvent> = [];
    // A truncated walk is newest-first and bounded, so rows older than its
    // oldest fetched row are unreachable — by this pass and by every later
    // one, since holding the cursor never shrinks the window from the top.
    // Holding would only re-fetch the same cap forever; instead the cursor is
    // allowed to recover up to that oldest fetched row, and the skip is raised.
    let walkFloorMs = Number.POSITIVE_INFINITY;
    for (const { identity, vaultSlug, events: classEvents, truncated, malformed } of perZivoeVault) {
      // Skipped rows are drift, not loss of the rest of the window — alarm on
      // them without letting one bad upstream row halt every alert. Each row's
      // identity rides along: these alerts are dropped for good, so the alarm
      // must name them.
      if (malformed.length > 0)
        Sentry.captureException(new Error('Centrifuge tx monitor skipped malformed indexer rows'), {
          tags: SENTRY_TAGS,
          extra: {
            shareClassKey: identity.key,
            count: malformed.length,
            rows: malformed.slice(0, 10),
            environment: ACTIVE_ENVIRONMENT
          }
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
          shareDecimals: identity.decimals,
          shareClassKey: identity.key,
          vaultSlug
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

    const linkedUsersByAccount = await readLinkedUsersByAccount({
      tx,
      accounts: [...new Set(fresh.map((row) => row.event.account))]
    });
    const items = fresh.map(({ event, symbol, shareDecimals }) =>
      formatTelegramItem({
        event,
        symbol,
        shareDecimals,
        emailLine: formatEmailLine((linkedUsersByAccount.get(event.account) ?? []).map((linked) => linked.email))
      })
    );

    await sendBatchedTelegramMessages({ chatId: env.TELEGRAM_TXS_CHAT_ID, items });

    // -- Fan the same events out to the Receipt Mailer: one QStash job per
    // (event, linked user), payloads self-contained (amounts as strings —
    // JSON cannot carry bigint) and free of email addresses. Publishing sits
    // between the Telegram send and the ledger record on purpose: recording
    // first would strand the emails of a pass that dies before publishing,
    // while a publish failure merely retries the whole pass — the QStash
    // deduplicationId, the mailer's (event, user) row, and Resend's
    // idempotency key each absorb the resulting replays in turn.
    const receiptJobs: Array<TransactionReceiptJobInput> = fresh.flatMap(({ id, event, shareClassKey, vaultSlug }) =>
      (linkedUsersByAccount.get(event.account) ?? []).map(({ userId }) => ({
        eventId: id,
        userId,
        vaultSlug,
        shareClassKey,
        event: {
          type: event.type,
          account: event.account,
          txHash: event.txHash,
          chainId: event.chainId,
          chainName: event.chainName,
          explorerUrl: event.explorerUrl,
          centrifugeId: event.centrifugeId,
          tokenAmount: event.tokenAmount === null ? null : event.tokenAmount.toString(),
          currencyAmount: event.currencyAmount === null ? null : event.currencyAmount.toString(),
          createdAtMs: event.createdAtMs
        }
      }))
    );
    for (let start = 0; start < receiptJobs.length; start += QSTASH_BATCH_LIMIT) {
      await qstash.batchJSON(
        receiptJobs.slice(start, start + QSTASH_BATCH_LIMIT).map((job) => ({
          url: `${BASE_URL}${TRANSACTION_RECEIPT_JOB_PATH}`,
          body: job,
          retries: 3,
          deduplicationId: `receipt-${buildReceiptJobKey({ eventId: job.eventId, userId: job.userId })}`,
          failureCallback: getQstashFailureCallback(BASE_URL),
          label: QSTASH_JOB_LABELS.emailTransactionReceipt
        }))
      );
    }

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
      skippedDuplicates: events.length - unnotified.length,
      emailJobsEnqueued: receiptJobs.length
    };
  });
}
