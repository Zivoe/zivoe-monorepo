import 'server-only';

import { CONTRACTS } from '@zivoe/contracts';

import { deposit as depositTable, redemption as redemptionTable } from '@/server/clients/ponder/schema';
import type { ReceiptTokenSymbol } from '@/server/utils/emails/receipt-config';
import { sendDepositConfirmationEmail, sendRedemptionConfirmationEmail } from '@/server/utils/send-email';

import { ApiError, escapeHtml, formatBigIntWithCommas } from '@/lib/utils';

import type { TransactionMonitorKind } from './run';

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

export const depositsMonitor: TransactionMonitorKind<typeof depositTable, IndexedInputDetails> = {
  slug: 'deposits-cron',
  routePath: '/api/monitor/deposits',
  eventType: 'deposit',
  eventNoun: 'deposits',
  table: depositTable,
  prepare: resolveInputDetailsFromIndexedDeposit,
  analytics: (event, input) => ({
    event: 'tx:deposit_confirmed',
    flow: 'deposit',
    tokenIn: input.tokenSymbol,
    tokenOut: 'zVLT',
    amountInRaw: input.amountRaw,
    amountOutRaw: event.shares
  }),
  telegramItem: ({ event, prepared, emailLine }) => {
    const zSttSuffix = ` (${escapeHtml(
      formatBigIntWithCommas({
        value: event.assets,
        tokenDecimals: 18,
        displayDecimals: 2,
        showUnderZero: true
      })
    )} zSTT)`;

    return `<b>Deposit</b>\nUser: ${event.accountId}\n${emailLine}\nInput: ${escapeHtml(
      formatBigIntWithCommas({
        value: prepared.amountRaw,
        tokenDecimals: prepared.decimals,
        displayDecimals: 2,
        showUnderZero: true
      })
    )} ${prepared.tokenSymbol}${zSttSuffix}\nReceived: ${escapeHtml(
      formatBigIntWithCommas({
        value: event.shares,
        tokenDecimals: 18,
        displayDecimals: 2,
        showUnderZero: true
      })
    )} zVLT\nTx: ${event.txHash}`;
  },
  sendConfirmationEmail: ({ event, prepared, user }) => {
    const inputAmount = `${formatBigIntWithCommas({
      value: prepared.amountRaw,
      tokenDecimals: prepared.decimals,
      displayDecimals: 2,
      showUnderZero: true
    })} ${prepared.tokenSymbol}`;

    const sharesReceived = `${formatBigIntWithCommas({
      value: event.shares,
      tokenDecimals: 18,
      displayDecimals: 2,
      showUnderZero: true
    })} zVLT`;

    return sendDepositConfirmationEmail({
      to: user.email,
      userId: user.userId,
      inputAmount,
      inputTokenSymbol: prepared.tokenSymbol,
      sharesReceived,
      walletAddress: event.accountId,
      txHash: event.txHash,
      eventTimestamp: event.timestamp,
      eventId: event.id
    });
  }
};

export const redemptionsMonitor: TransactionMonitorKind<typeof redemptionTable, undefined> = {
  slug: 'redemptions-cron',
  routePath: '/api/monitor/redemptions',
  eventType: 'redemption',
  eventNoun: 'redemptions',
  table: redemptionTable,
  prepare: () => undefined,
  analytics: (event) => ({
    event: 'tx:redeem_confirmed',
    flow: 'redeem',
    tokenIn: 'zVLT',
    tokenOut: 'USDC',
    amountInRaw: event.zVLTBurned,
    amountOutRaw: event.usdcRedeemed
  }),
  telegramItem: ({ event, emailLine }) =>
    `<b>Redeem</b>\nUser: ${event.accountId}\n${emailLine}\nzVLT burned: ${escapeHtml(
      formatBigIntWithCommas({
        value: event.zVLTBurned,
        tokenDecimals: 18,
        displayDecimals: 2,
        showUnderZero: true
      })
    )}\nUSDC redeemed: ${escapeHtml(
      formatBigIntWithCommas({
        value: event.usdcRedeemed,
        tokenDecimals: 6,
        displayDecimals: 2,
        showUnderZero: true
      })
    )}\nFee: ${escapeHtml(
      formatBigIntWithCommas({
        value: event.fee,
        tokenDecimals: 6,
        displayDecimals: 2,
        showUnderZero: true
      })
    )}\nTx: ${event.txHash}`,
  sendConfirmationEmail: ({ event, user }) => {
    const zVLTRedeemed = `${formatBigIntWithCommas({
      value: event.zVLTBurned,
      tokenDecimals: 18,
      displayDecimals: 2,
      showUnderZero: true
    })} zVLT`;

    const usdcReceived = `${formatBigIntWithCommas({
      value: event.usdcRedeemed,
      tokenDecimals: 6,
      displayDecimals: 2,
      showUnderZero: true
    })} USDC`;

    const fee = `${formatBigIntWithCommas({
      value: event.fee,
      tokenDecimals: 6,
      displayDecimals: 2,
      showUnderZero: true
    })} USDC`;

    return sendRedemptionConfirmationEmail({
      to: user.email,
      userId: user.userId,
      zVLTRedeemed,
      usdcReceived,
      fee,
      walletAddress: event.accountId,
      txHash: event.txHash,
      eventTimestamp: event.timestamp,
      eventId: event.id
    });
  }
};
