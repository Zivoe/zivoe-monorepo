import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { redemption as redemptionTable } from '@/server/clients/ponder/schema';
import { getWeb3Client } from '@/server/clients/web3';
import { isEmailPreferenceEnabled } from '@/server/data/email-preferences';
import { getEventsAfterCursor } from '@/server/data/ponder';
import {
  createCronRunWideEvent,
  getErrorMessage,
  logCronWideEvent,
  parseQstashRetried,
  pushSample
} from '@/server/utils/cron-observability';
import { sendRedemptionConfirmationEmail } from '@/server/utils/send-email';
import { sendBatchedTelegramMessages } from '@/server/utils/send-telegram';
import {
  EVENT_BATCH_LIMIT,
  FINALITY_CONFIRMATIONS,
  formatTelegramEmailLine,
  getMonitorCursor,
  getUsersForWallet,
  recordEmailSent,
  updateMonitorCursor,
  wasEmailSent
} from '@/server/utils/transaction-notifications';
import type { FailureContext, MonitorCursor } from '@/server/utils/transaction-notifications';

import { withQstashSignature } from '@/lib/qstash';
import { ApiError, escapeHtml, formatBigIntWithCommas, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

export const maxDuration = 60; // seconds

const MONITOR_SLUG = 'redemptions-cron';
const ROUTE_PATH = '/api/monitor/redemptions';

const handler = async (req: NextRequest): ApiResponse<string> => {
  const startTime = Date.now();
  const sentryCheckInId = Sentry.captureCheckIn({
    monitorSlug: MONITOR_SLUG,
    status: 'in_progress'
  });

  const runEvent = createCronRunWideEvent({
    flow: MONITOR_SLUG,
    route: ROUTE_PATH,
    qstashMessageId: req.headers.get('upstash-message-id') ?? undefined,
    qstashScheduleId: req.headers.get('upstash-schedule-id') ?? undefined,
    qstashRetried: parseQstashRetried(req.headers.get('upstash-retried'))
  });

  let cursorEnd: MonitorCursor = { lastBlockNumber: 0n, lastLogIndex: -1 };
  let failureContext: FailureContext = {};

  Sentry.setTag('source', 'SERVER');
  Sentry.setTag('flow', MONITOR_SLUG);

  try {
    const web3 = getWeb3Client();

    runEvent.stage = 'run_init';
    const latestBlockNumber = await web3.getBlockNumber();
    runEvent.latestBlockNumber = latestBlockNumber;

    if (latestBlockNumber <= FINALITY_CONFIRMATIONS)
      throw new ApiError({ message: 'Latest block number is too low', status: 500 });

    const safeBlockNumber = latestBlockNumber - FINALITY_CONFIRMATIONS;
    runEvent.safeBlockNumber = safeBlockNumber;

    const cursor = await getMonitorCursor('redemption');
    runEvent.cursorStartBlockNumber = cursor.lastBlockNumber;
    runEvent.cursorStartLogIndex = cursor.lastLogIndex;
    runEvent.cursorEndBlockNumber = cursor.lastBlockNumber;
    runEvent.cursorEndLogIndex = cursor.lastLogIndex;
    cursorEnd = cursor;

    runEvent.stage = 'fetch_events';
    const redemptions = await getEventsAfterCursor({
      table: redemptionTable,
      tableName: 'redemption',
      cursor,
      safeBlockNumber,
      limit: EVENT_BATCH_LIMIT
    });
    runEvent.counters.fetchedEvents = redemptions.length;
    const receiptPreferenceCache = new Map<string, boolean>();

    const telegramItems: Array<string> = [];

    for (const redemption of redemptions) {
      const eventCursor = {
        lastBlockNumber: redemption.blockNumber,
        lastLogIndex: redemption.logIndex
      };

      failureContext = {
        eventId: redemption.id,
        txHash: redemption.txHash,
        walletAddress: redemption.accountId,
        blockNumber: redemption.blockNumber,
        logIndex: redemption.logIndex
      };

      runEvent.stage = 'get_users';
      const users = await getUsersForWallet(redemption.accountId);
      const telegramEmailLine = formatTelegramEmailLine(users);

      telegramItems.push(
        `<b>Redeem</b>\nUser: ${redemption.accountId}\n${telegramEmailLine}\nzVLT burned: ${escapeHtml(
          formatBigIntWithCommas({
            value: redemption.zVLTBurned,
            tokenDecimals: 18,
            displayDecimals: 2,
            showUnderZero: true
          })
        )}\nUSDC redeemed: ${escapeHtml(
          formatBigIntWithCommas({
            value: redemption.usdcRedeemed,
            tokenDecimals: 6,
            displayDecimals: 2,
            showUnderZero: true
          })
        )}\nFee: ${escapeHtml(
          formatBigIntWithCommas({
            value: redemption.fee,
            tokenDecimals: 6,
            displayDecimals: 2,
            showUnderZero: true
          })
        )}\nTx: ${redemption.txHash}`
      );

      if (users.length === 0) {
        runEvent.counters.skippedNoUserEvents++;
        pushSample(runEvent.samples.skippedNoUserEventIds, redemption.id);

        runEvent.stage = 'update_cursor';
        await updateMonitorCursor('redemption', eventCursor);
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
        const alreadySent = await wasEmailSent({ eventId: redemption.id, userId: userRecord.userId });
        if (alreadySent) {
          runEvent.counters.skippedAlreadySent++;
          pushSample(runEvent.samples.skippedAlreadySent, {
            eventId: redemption.id,
            userId: userRecord.userId
          });
          continue;
        }

        const zVLTRedeemed = `${formatBigIntWithCommas({
          value: redemption.zVLTBurned,
          tokenDecimals: 18,
          displayDecimals: 2,
          showUnderZero: true
        })} zVLT`;

        const usdcReceived = `${formatBigIntWithCommas({
          value: redemption.usdcRedeemed,
          tokenDecimals: 6,
          displayDecimals: 2,
          showUnderZero: true
        })} USDC`;

        const fee = `${formatBigIntWithCommas({
          value: redemption.fee,
          tokenDecimals: 6,
          displayDecimals: 2,
          showUnderZero: true
        })} USDC`;

        runEvent.stage = 'send_email';
        const { err: emailErr } = await handlePromise(
          sendRedemptionConfirmationEmail({
            to: userRecord.email,
            userId: userRecord.userId,
            zVLTRedeemed,
            usdcReceived,
            fee,
            walletAddress: redemption.accountId,
            txHash: redemption.txHash,
            eventTimestamp: redemption.timestamp,
            eventId: redemption.id
          })
        );

        if (emailErr) {
          throw new ApiError({
            message: `Failed to send redemption confirmation email for event ${redemption.id} and user ${userRecord.userId}`,
            status: 500,
            exception: emailErr
          });
        }

        runEvent.stage = 'record_email';
        const { err: recordErr } = await handlePromise(
          recordEmailSent({
            eventId: redemption.id,
            txHash: redemption.txHash,
            logIndex: redemption.logIndex,
            userId: userRecord.userId,
            walletAddress: redemption.accountId,
            eventType: 'redemption'
          })
        );

        if (recordErr) {
          throw new ApiError({
            message: `Failed to persist sent-email deduplication record for event ${redemption.id} and user ${userRecord.userId}`,
            status: 500,
            exception: recordErr
          });
        }

        runEvent.counters.emailsSent++;
      }

      runEvent.stage = 'update_cursor';
      await updateMonitorCursor('redemption', eventCursor);
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
        tags: { source: 'SERVER', flow: MONITOR_SLUG }
      });
    }

    runEvent.stage = 'run_finalize';
    runEvent.status = 'ok';
    runEvent.durationMs = Date.now() - startTime;

    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: 'ok'
    });

    return NextResponse.json({
      success: true,
      data: `Processed ${runEvent.counters.processedEvents} redemptions. Sent ${runEvent.counters.emailsSent} emails.`
    });
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
      monitorSlug: MONITOR_SLUG,
      status: 'error'
    });

    throw error;
  } finally {
    runEvent.cursorEndBlockNumber ??= cursorEnd.lastBlockNumber;
    runEvent.cursorEndLogIndex ??= cursorEnd.lastLogIndex;

    logCronWideEvent(runEvent);

    await Sentry.flush(2000);
  }
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error processing redemption notifications', handler)(req);
});
