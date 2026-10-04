import 'server-only';

import { escapeHtml } from '@/lib/utils';

import { type KycOperatorStatus } from './kyc-status';
import { type OperatorMessenger } from './kyc-verification';

/**
 * One line per lifecycle move in `KYC_OPERATOR_STATUSES`. A failure is not
 * the end of the story: the Inquiry Failed Workflow decides it seconds later,
 * and that decision arrives as its own message.
 */
const LABELS: Record<KycOperatorStatus, string> = {
  in_progress: 'Started or resumed the flow',
  submitted: 'Submitted — awaiting decision',
  pending_review: 'Needs manual review',
  approved: 'Approved',
  declined: 'Declined',
  failed: 'Verification failed — awaiting Persona Workflow'
};

/**
 * Names the user (id and email), the inquiry id and the status; the name and
 * documents stay in Persona.
 */
export function formatOperatorMessage({
  status,
  userId,
  email,
  inquiryId
}: Parameters<OperatorMessenger['send']>[0]): string {
  return [
    '<b>KYC Verification</b>',
    '',
    `<b>Status:</b> ${escapeHtml(LABELS[status])}`,
    `<b>User:</b> ${escapeHtml(userId)}`,
    `<b>Email:</b> ${email ? escapeHtml(email) : 'unknown (profile gone)'}`,
    `<b>Inquiry:</b> ${escapeHtml(inquiryId)}`
  ].join('\n');
}

/** The OperatorMessenger port over the Persona Telegram channel. */
export function createTelegramOperatorMessenger({
  sendTelegramMessage,
  chatId
}: {
  sendTelegramMessage: (input: { chatId: string; text: string }) => Promise<unknown>;
  chatId: string;
}): OperatorMessenger {
  return {
    async send(input) {
      await sendTelegramMessage({ chatId, text: formatOperatorMessage(input) });
    }
  };
}
