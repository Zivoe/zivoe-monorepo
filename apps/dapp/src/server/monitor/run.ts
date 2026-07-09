import 'server-only';

import * as Sentry from '@sentry/nextjs';

import type { TransactionEventType } from '@zivoe/database/schema';

import type { deposit, redemption } from '@/server/clients/ponder/schema';
import { getWeb3Client } from '@/server/clients/web3';
import { isEmailPreferenceEnabled } from '@/server/data/email-preferences';
import { getEventsAfterCursor } from '@/server/data/ponder';
import { captureServerEvent } from '@/server/utils/analytics';
import { sendBatchedTelegramMessages } from '@/server/utils/send-telegram';

import type { AnalyticsEvent, TransactionAnalyticsInput } from '@/lib/analytics/events';
import { createTransactionProperties } from '@/lib/analytics/events';
import { ApiError, handlePromise } from '@/lib/utils';

import { env } from '@/env';

import {
  EVENT_BATCH_LIMIT,
  FINALITY_CONFIRMATIONS,
  formatTelegramEmailLine,
  getMonitorCursor,
  getUsersForWallet,
  recordEmailSent,
  updateMonitorCursor,
  wasEmailSent
} from './notifications';
import type { FailureContext, MonitorCursor } from './notifications';
import {
  createCronRunWideEvent,
  getErrorMessage,
  logCronWideEvent,
  parseQstashRetried,
  pushSample
} from './observability';
import type { CronFlow } from './observability';

export type MonitorTable = typeof deposit | typeof redemption;

type MonitorEvent<TTable extends MonitorTable> = TTable['$inferSelect'];

export type MonitorWalletUser = Awaited<ReturnType<typeof getUsersForWallet>>[number];

export type QstashRunMeta = {
  messageId?: string;
  scheduleId?: string;
  retried?: number;
};

export function readQstashRunMeta(headers: Headers): QstashRunMeta {
  return {
    messageId: headers.get('upstash-message-id') ?? undefined,
    scheduleId: headers.get('upstash-schedule-id') ?? undefined,
    retried: parseQstashRetried(headers.get('upstash-retried'))
  };
}

type MonitorAnalytics = Pick<
  TransactionAnalyticsInput,
  'flow' | 'tokenIn' | 'tokenOut' | 'amountInRaw' | 'amountOutRaw'
> & { event: AnalyticsEvent };

export type TransactionMonitorKind<TTable extends MonitorTable, TPrepared> = {
  slug: CronFlow;
  routePath: string;
  /** Keys the Monitor Cursor row, the dedupe record, and the ponder table name. */
  eventType: TransactionEventType;
  /** Plural noun for the run summary, e.g. "deposits". */
  eventNoun: string;
  table: TTable;
  /** Derives kind-specific details for one event before any notification side effect; throw ApiError to fail the pass. */
  prepare: (event: MonitorEvent<TTable>) => TPrepared;
  analytics: (event: MonitorEvent<TTable>, prepared: TPrepared) => MonitorAnalytics;
  telegramItem: (input: { event: MonitorEvent<TTable>; prepared: TPrepared; emailLine: string }) => string;
  sendConfirmationEmail: (input: {
    event: MonitorEvent<TTable>;
    prepared: TPrepared;
    user: MonitorWalletUser;
  }) => Promise<unknown>;
};

/**
 * Runs one Monitor Pass for a Monitor Kind: advance from the Monitor Cursor to the
 * safe block, fan out notifications (analytics, Telegram, confirmation emails with
 * dedupe), and move the cursor forward. Returns the run summary for the response.
 */
export async function runTransactionMonitor<TTable extends MonitorTable, TPrepared>(
  kind: TransactionMonitorKind<TTable, TPrepared>,
  qstash: QstashRunMeta
): Promise<string> {
  const startTime = Date.now();

  const sentryCheckInId = Sentry.captureCheckIn({
    monitorSlug: kind.slug,
    status: 'in_progress'
  });

  const runEvent = createCronRunWideEvent({
    flow: kind.slug,
    route: kind.routePath,
    qstashMessageId: qstash.messageId,
    qstashScheduleId: qstash.scheduleId,
    qstashRetried: qstash.retried
  });

  let cursorEnd: MonitorCursor = { lastBlockNumber: 0n, lastLogIndex: -1 };
  let failureContext: FailureContext = {};

  Sentry.setTag('source', 'SERVER');
  Sentry.setTag('flow', kind.slug);

  try {
    const web3 = getWeb3Client();

    runEvent.stage = 'run_init';
    const latestBlockNumber = await web3.getBlockNumber();
    runEvent.latestBlockNumber = latestBlockNumber;

    if (latestBlockNumber <= FINALITY_CONFIRMATIONS)
      throw new ApiError({ message: 'Latest block number is too low', status: 500 });

    const safeBlockNumber = latestBlockNumber - FINALITY_CONFIRMATIONS;
    runEvent.safeBlockNumber = safeBlockNumber;

    const cursor = await getMonitorCursor(kind.eventType);
    runEvent.cursorStartBlockNumber = cursor.lastBlockNumber;
    runEvent.cursorStartLogIndex = cursor.lastLogIndex;
    runEvent.cursorEndBlockNumber = cursor.lastBlockNumber;
    runEvent.cursorEndLogIndex = cursor.lastLogIndex;
    cursorEnd = cursor;

    runEvent.stage = 'fetch_events';
    const events = await getEventsAfterCursor({
      table: kind.table,
      tableName: kind.eventType,
      cursor,
      safeBlockNumber,
      limit: EVENT_BATCH_LIMIT
    });
    runEvent.counters.fetchedEvents = events.length;
    const receiptPreferenceCache = new Map<string, boolean>();

    const telegramItems: Array<string> = [];

    for (const event of events) {
      const eventCursor = {
        lastBlockNumber: event.blockNumber,
        lastLogIndex: event.logIndex
      };

      failureContext = {
        eventId: event.id,
        txHash: event.txHash,
        walletAddress: event.accountId,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex
      };

      runEvent.stage = 'infer_input_details';
      const prepared = kind.prepare(event);

      runEvent.stage = 'get_users';
      const users = await getUsersForWallet(event.accountId);
      const telegramEmailLine = formatTelegramEmailLine(users);

      const analytics = kind.analytics(event, prepared);

      await Promise.all(
        users.map((userRecord) =>
          captureServerEvent({
            distinctId: userRecord.userId,
            event: analytics.event,
            timestamp: new Date(Number(event.timestamp) * 1000),
            properties: {
              ...createTransactionProperties({
                flow: analytics.flow,
                step: 'confirmed',
                walletAddress: event.accountId,
                tokenIn: analytics.tokenIn,
                tokenOut: analytics.tokenOut,
                amountInRaw: analytics.amountInRaw,
                amountOutRaw: analytics.amountOutRaw,
                txHash: event.txHash,
                blockNumber: event.blockNumber,
                logIndex: event.logIndex,
                eventId: event.id
              }),
              $insert_id: `${analytics.event}:${event.id}:${userRecord.userId}`
            }
          })
        )
      );

      telegramItems.push(kind.telegramItem({ event, prepared, emailLine: telegramEmailLine }));

      if (users.length === 0) {
        runEvent.counters.skippedNoUserEvents++;
        pushSample(runEvent.samples.skippedNoUserEventIds, event.id);

        runEvent.stage = 'update_cursor';
        await updateMonitorCursor(kind.eventType, eventCursor);
        runEvent.counters.cursorUpdates++;

        cursorEnd = eventCursor;
        runEvent.cursorEndBlockNumber = eventCursor.lastBlockNumber;
        runEvent.cursorEndLogIndex = eventCursor.lastLogIndex;

        continue;
      }

      for (const userRecord of users) {
        failureContext = {
          ...failureContext,
          userId: userRecord.userId
        };

        const cachedPreference = receiptPreferenceCache.get(userRecord.userId);
        const canReceiveTransactionEmails =
          cachedPreference ??
          (await isEmailPreferenceEnabled({
            userId: userRecord.userId,
            bucket: 'transaction_receipts'
          }));
        receiptPreferenceCache.set(userRecord.userId, canReceiveTransactionEmails);

        if (!canReceiveTransactionEmails) continue;

        runEvent.stage = 'dedupe_check';
        const alreadySent = await wasEmailSent({ eventId: event.id, userId: userRecord.userId });
        if (alreadySent) {
          runEvent.counters.skippedAlreadySent++;
          pushSample(runEvent.samples.skippedAlreadySent, {
            eventId: event.id,
            userId: userRecord.userId
          });
          continue;
        }

        runEvent.stage = 'send_email';
        const { err: emailErr } = await handlePromise(
          kind.sendConfirmationEmail({ event, prepared, user: userRecord })
        );

        if (emailErr) {
          throw new ApiError({
            message: `Failed to send ${kind.eventType} confirmation email for event ${event.id} and user ${userRecord.userId}`,
            status: 500,
            exception: emailErr
          });
        }

        runEvent.stage = 'record_email';
        const { err: recordErr } = await handlePromise(
          recordEmailSent({
            eventId: event.id,
            txHash: event.txHash,
            logIndex: event.logIndex,
            userId: userRecord.userId,
            walletAddress: event.accountId,
            eventType: kind.eventType
          })
        );

        if (recordErr) {
          throw new ApiError({
            message: `Failed to persist sent-email deduplication record for event ${event.id} and user ${userRecord.userId}`,
            status: 500,
            exception: recordErr
          });
        }

        runEvent.counters.emailsSent++;
      }

      runEvent.stage = 'update_cursor';
      await updateMonitorCursor(kind.eventType, eventCursor);
      runEvent.counters.cursorUpdates++;
      runEvent.counters.processedEvents++;

      cursorEnd = eventCursor;
      runEvent.cursorEndBlockNumber = eventCursor.lastBlockNumber;
      runEvent.cursorEndLogIndex = eventCursor.lastLogIndex;
      failureContext = {};
    }

    runEvent.stage = 'send_telegram';
    const { err: telegramErr } = await handlePromise(
      sendBatchedTelegramMessages({
        chatId: env.TELEGRAM_TXS_CHAT_ID,
        items: telegramItems
      })
    );

    if (telegramErr) {
      runEvent.counters.telegramFailures++;

      Sentry.captureException(telegramErr, {
        tags: { source: 'SERVER', flow: kind.slug }
      });
    }

    runEvent.stage = 'run_finalize';
    runEvent.status = 'ok';
    runEvent.durationMs = Date.now() - startTime;

    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: kind.slug,
      status: 'ok'
    });

    return `Processed ${runEvent.counters.processedEvents} ${kind.eventNoun}. Sent ${runEvent.counters.emailsSent} emails.`;
  } catch (error) {
    runEvent.status = 'error';
    runEvent.durationMs = Date.now() - startTime;
    runEvent.failure = {
      stage: runEvent.stage,
      message: getErrorMessage(error),
      ...failureContext
    };

    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: kind.slug,
      status: 'error'
    });

    throw error;
  } finally {
    runEvent.cursorEndBlockNumber ??= cursorEnd.lastBlockNumber;
    runEvent.cursorEndLogIndex ??= cursorEnd.lastLogIndex;

    logCronWideEvent(runEvent);

    await Sentry.flush(2000);
  }
}
