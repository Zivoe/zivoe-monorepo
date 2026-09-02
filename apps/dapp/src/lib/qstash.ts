import { type NextRequest } from 'next/server';

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

export type AppRouteHandler = (req: NextRequest) => Promise<Response>;

export function withQstashSignature(handler: AppRouteHandler): AppRouteHandler {
  return verifySignatureAppRouter((req: Request) => handler(req as NextRequest)) as AppRouteHandler;
}

export const QSTASH_FAILURE_CALLBACK_PATH = '/api/qstash/failure';

/** One cron string shared by the QStash schedule and the Sentry cron monitor, so they cannot drift. */
export const CENTRIFUGE_TX_MONITOR_CRON = '*/5 * * * *';

export const QSTASH_JOB_LABELS = {
  monitorCentrifugeTransactions: 'monitor.centrifuge-transactions',
  monitorRefreshHoldings: 'monitor.refresh-holdings',
  monitorDlq: 'monitor.dlq',
  emailOnboardingReminder: 'email.onboarding-reminder',
  emailWelcome: 'email.welcome',
  emailDepositReminderFirst: 'email.deposit-reminder.first',
  emailDepositReminderSecond: 'email.deposit-reminder.second',
  emailTransactionReceipt: 'email.transaction-receipt',
  telegramOnboarding: 'telegram.onboarding',
  walletFetchHoldings: 'wallet.fetch-holdings'
} as const;

export function getQstashFailureCallback(baseUrl: string): string {
  return `${baseUrl}${QSTASH_FAILURE_CALLBACK_PATH}`;
}
