import { type NextRequest } from 'next/server';

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

export type AppRouteHandler = (req: NextRequest) => Promise<Response>;

export function withQstashSignature(handler: AppRouteHandler): AppRouteHandler {
  return verifySignatureAppRouter((req: Request) => handler(req as NextRequest)) as AppRouteHandler;
}

export const QSTASH_FAILURE_CALLBACK_PATH = '/api/qstash/failure';

/**
 * Status and header that tell QStash not to retry. For a receiver whose
 * payload our own outbox produced, a parse failure is a contract bug: a retry
 * cannot fix it, and three of them only delay the alert by half an hour.
 */
export const QSTASH_NON_RETRYABLE = { status: 489, headers: { 'Upstash-NonRetryable-Error': 'true' } } as const;

/** One cron string shared by the QStash schedule and the Sentry cron monitor, so they cannot drift. */
export const CENTRIFUGE_TX_MONITOR_CRON = '*/5 * * * *';
/**
 * The KYC Reconciliation Sweep's cadence — same pairing with its Sentry cron
 * monitor. Must divide 60: the review digest fires on the one run that opens
 * its hour, and the route keys that test on this step.
 */
export const KYC_RECONCILE_STEP_MINUTES = 15;
export const KYC_RECONCILE_CRON = `*/${KYC_RECONCILE_STEP_MINUTES} * * * *`;
/** Daily check that the Persona dashboard's webhook still matches what the code handles. */
export const KYC_WEBHOOK_DRIFT_CRON = '0 8 * * *';

// One slug per cron for its Sentry monitor AND its route's `flow` tag, so
// the two views correlate. Kept here rather than exported from the route
// files: a route module may only export the handler and its config.
export const KYC_RECONCILE_SLUG = 'kyc-reconcile-cron';
export const KYC_WEBHOOK_DRIFT_SLUG = 'kyc-webhook-drift-cron';

export const QSTASH_JOB_LABELS = {
  monitorCentrifugeTransactions: 'monitor.centrifuge-transactions',
  monitorRefreshHoldings: 'monitor.refresh-holdings',
  monitorDlq: 'monitor.dlq',
  kycReconcile: 'kyc.reconcile',
  kycWebhookDrift: 'kyc.webhook-drift',
  kycOperator: 'kyc.operator',
  emailOnboardingReminder: 'email.onboarding-reminder',
  emailWelcome: 'email.welcome',
  emailDepositReminderFirst: 'email.deposit-reminder.first',
  emailDepositReminderSecond: 'email.deposit-reminder.second',
  emailTransactionReceipt: 'email.transaction-receipt',
  emailKycStatus: 'email.kyc-status',
  telegramOnboarding: 'telegram.onboarding',
  telegramKyc: 'telegram.kyc',
  walletFetchHoldings: 'wallet.fetch-holdings'
} as const;

export function getQstashFailureCallback(baseUrl: string): string {
  return `${baseUrl}${QSTASH_FAILURE_CALLBACK_PATH}`;
}
