import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

import { CONTRACTS } from '@zivoe/contracts';

import { deposit as depositTable } from '@/server/clients/ponder/schema';
import { getWeb3Client } from '@/server/clients/web3';
import { getEventsAfterCursor } from '@/server/data/ponder';
import {
  createCronRunWideEvent,
  getErrorMessage,
  logCronWideEvent,
  parseQstashRetried,
  pushSample
} from '@/server/utils/cron-observability';
import type { ReceiptTokenSymbol } from '@/server/utils/emails/receipt-config';
import { sendDepositConfirmationEmail } from '@/server/utils/send-email';
import { sendBatchedTelegramMessages } from '@/server/utils/send-telegram';
import {
  EVENT_BATCH_LIMIT,
  FINALITY_CONFIRMATIONS,
  getMonitorCursor,
  getUsersForWallet,
  recordEmailSent,
  updateMonitorCursor,
  wasEmailSent
} from '@/server/utils/transaction-notifications';
import type { FailureContext, MonitorCursor } from '@/server/utils/transaction-notifications';

import { ApiError, escapeHtml, formatBigIntWithCommas, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { ApiResponse } from '../../utils';

export const maxDuration = 60; // seconds

const MONITOR_SLUG = 'deposits-cron';
const ROUTE_PATH = '/api/monitor/deposits';

type IndexedInputDetails = {
  tokenSymbol: ReceiptTokenSymbol;
  amountRaw: bigint;
  decimals: number;
};

const TOKEN_METADATA_BY_ADDRESS: Record<string, { symbol: ReceiptTokenSymbol; decimals: number }> = {
  [CONTRACTS.USDC.toLowerCase()]: { symbol: 'USDC', decimals: 6 },
  [CONTRACTS.USDT.toLowerCase()]: { symbol: 'USDT', decimals: 6 },
  [CONTRACTS.frxUSD.toLowerCase()]: { symbol: 'frxUSD', decimals: 18 }
};

function resolveInputDetailsFromIndexedDeposit(deposit: typeof depositTable.$inferSelect): IndexedInputDetails {
  const eventContext = `eventId=${deposit.id}, txHash=${deposit.txHash}, blockNumber=${deposit.blockNumber}, logIndex=${deposit.logIndex}`;

  if (!deposit.inputTokenAddress || deposit.inputAmountRaw === null) {
    throw new ApiError({
      message: `Missing indexed router input details (${eventContext})`,
      status: 500
    });
  }

  const normalizedInputTokenAddress = deposit.inputTokenAddress.toLowerCase();
  const tokenMetadata = TOKEN_METADATA_BY_ADDRESS[normalizedInputTokenAddress];

  if (!tokenMetadata) {
    throw new ApiError({
      message: `unsupported_input_token_address: ${normalizedInputTokenAddress} (${eventContext})`,
      status: 500
    });
  }

  return {
    tokenSymbol: tokenMetadata.symbol,
    amountRaw: deposit.inputAmountRaw,
    decimals: tokenMetadata.decimals
  };
}

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

    const cursor = await getMonitorCursor('deposit');
    runEvent.cursorStartBlockNumber = cursor.lastBlockNumber;
    runEvent.cursorStartLogIndex = cursor.lastLogIndex;
    runEvent.cursorEndBlockNumber = cursor.lastBlockNumber;
    runEvent.cursorEndLogIndex = cursor.lastLogIndex;
    cursorEnd = cursor;

    runEvent.stage = 'fetch_events';
    const deposits = await getEventsAfterCursor({
      table: depositTable,
      tableName: 'deposit',
      cursor,
      safeBlockNumber,
      limit: EVENT_BATCH_LIMIT
    });
    runEvent.counters.fetchedEvents = deposits.length;

    const telegramItems: string[] = [];

    for (const deposit of deposits) {
      const eventCursor = {
        lastBlockNumber: deposit.blockNumber,
        lastLogIndex: deposit.logIndex
      };

      failureContext = {
        eventId: deposit.id,
        txHash: deposit.txHash,
        walletAddress: deposit.accountId,
        blockNumber: deposit.blockNumber,
        logIndex: deposit.logIndex
      };

      runEvent.stage = 'infer_input_details';
      const inputDetails = resolveInputDetailsFromIndexedDeposit(deposit);

      const zSttSuffix = ` (${escapeHtml(
        formatBigIntWithCommas({
          value: deposit.assets,
          tokenDecimals: 18,
          displayDecimals: 2,
          showUnderZero: true
        })
      )} zSTT)`;

      telegramItems.push(
        `<b>Deposit</b>\nUser: ${deposit.accountId}\nInput: ${escapeHtml(
          formatBigIntWithCommas({
            value: inputDetails.amountRaw,
            tokenDecimals: inputDetails.decimals,
            displayDecimals: 2,
            showUnderZero: true
          })
        )} ${inputDetails.tokenSymbol}${zSttSuffix}\nReceived: ${escapeHtml(
          formatBigIntWithCommas({
            value: deposit.shares,
            tokenDecimals: 18,
            displayDecimals: 2,
            showUnderZero: true
          })
        )} zVLT\nTx: ${deposit.txHash}`
      );

      runEvent.stage = 'get_users';
      const users = await getUsersForWallet(deposit.accountId);

      if (users.length === 0) {
        runEvent.counters.skippedNoUserEvents++;
        pushSample(runEvent.samples.skippedNoUserEventIds, deposit.id);

        runEvent.stage = 'update_cursor';
        await updateMonitorCursor('deposit', eventCursor);
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

        runEvent.stage = 'dedupe_check';
        const alreadySent = await wasEmailSent({ eventId: deposit.id, userId: userRecord.userId });
        if (alreadySent) {
          runEvent.counters.skippedAlreadySent++;
          pushSample(runEvent.samples.skippedAlreadySent, {
            eventId: deposit.id,
            userId: userRecord.userId
          });
          continue;
        }

        const inputAmount = `${formatBigIntWithCommas({
          value: inputDetails.amountRaw,
          tokenDecimals: inputDetails.decimals,
          displayDecimals: 2,
          showUnderZero: true
        })} ${inputDetails.tokenSymbol}`;

        const sharesReceived = `${formatBigIntWithCommas({
          value: deposit.shares,
          tokenDecimals: 18,
          displayDecimals: 2,
          showUnderZero: true
        })} zVLT`;

        runEvent.stage = 'send_email';
        const { err: emailErr } = await handlePromise(
          sendDepositConfirmationEmail({
            to: userRecord.email,
            userId: userRecord.userId,
            inputAmount,
            inputTokenSymbol: inputDetails.tokenSymbol,
            sharesReceived,
            walletAddress: deposit.accountId,
            txHash: deposit.txHash,
            eventTimestamp: deposit.timestamp,
            eventId: deposit.id
          })
        );

        if (emailErr) {
          throw new ApiError({
            message: `Failed to send deposit confirmation email for event ${deposit.id} and user ${userRecord.userId}`,
            status: 500,
            exception: emailErr
          });
        }

        runEvent.stage = 'record_email';
        const { err: recordErr } = await handlePromise(
          recordEmailSent({
            eventId: deposit.id,
            txHash: deposit.txHash,
            logIndex: deposit.logIndex,
            userId: userRecord.userId,
            walletAddress: deposit.accountId,
            eventType: 'deposit'
          })
        );

        if (recordErr) {
          throw new ApiError({
            message: `Failed to persist sent-email deduplication record for event ${deposit.id} and user ${userRecord.userId}`,
            status: 500,
            exception: recordErr
          });
        }

        runEvent.counters.emailsSent++;
      }

      runEvent.stage = 'update_cursor';
      await updateMonitorCursor('deposit', eventCursor);
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
      data: `Processed ${runEvent.counters.processedEvents} deposits. Sent ${runEvent.counters.emailsSent} emails.`
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

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error processing deposit notifications', handler)(req);
});
