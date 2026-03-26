export const QSTASH_FAILURE_CALLBACK_PATH = '/api/qstash/failure';

export const QSTASH_JOB_LABELS = {
  monitorNetworkLive: 'monitor.network.live',
  monitorRefreshHoldings: 'monitor.refresh-holdings',
  monitorDeposits: 'monitor.deposits',
  monitorRedemptions: 'monitor.redemptions',
  monitorDlq: 'monitor.dlq',
  emailOnboardingReminder: 'email.onboarding-reminder',
  emailWelcome: 'email.welcome',
  emailDepositReminderFirst: 'email.deposit-reminder.first',
  emailDepositReminderSecond: 'email.deposit-reminder.second',
  telegramOnboarding: 'telegram.onboarding',
  walletFetchHoldings: 'wallet.fetch-holdings'
} as const;

export function getQstashFailureCallback(baseUrl: string): string {
  return `${baseUrl}${QSTASH_FAILURE_CALLBACK_PATH}`;
}
