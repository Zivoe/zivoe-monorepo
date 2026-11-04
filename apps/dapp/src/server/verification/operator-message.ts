import 'server-only';

import { escapeHtml } from '@/lib/utils';

import { type OperatorMessenger } from './verification';
import { type VerificationOperatorStatus } from './verification-status';

/**
 * One line per lifecycle move in `VERIFICATION_OPERATOR_STATUSES`. A failure is not
 * the end of the story for an individual: the Inquiry Failed Workflow
 * decides it seconds later, and that decision arrives as its own message.
 */
const LABELS: Record<VerificationOperatorStatus, string> = {
  in_progress: 'Started or resumed the flow',
  submitted: 'Submitted — awaiting decision',
  pending_review: 'Needs manual review',
  approved: 'Approved',
  declined: 'Declined',
  failed: 'Verification failed — awaiting Persona Workflow'
};

/** What a status line says: the move, with the moves that mean something else. */
function statusLine(input: Parameters<OperatorMessenger['send']>[0]): string {
  if (input.kind === 'case_status') return `Case moved to ${input.case.status} (verification ${input.status})`;
  // A reviewer, or a resync, reversed a Decision: ops may have whitelisted the addresses an approval let them link.
  if (input.status === 'declined' && input.previousDecision === 'approved')
    return 'Declined — the approval no longer stands';
  if (input.status === 'approved' && input.previousDecision === 'declined') return 'Approved after a decline';
  if (input.accountType !== 'organization') return LABELS[input.status];
  // A reviewer took a Decision back by reopening the case: a review, like the email's check.
  if (input.status === 'pending_review' && input.previousDecision === 'approved')
    return 'KYB case reopened — the approval no longer stands';
  if (input.status === 'pending_review' && input.previousDecision === 'declined')
    return 'KYB case reopened after a decline';
  // The KYB Workflow opened the case; who it waits on is the case line below.
  if (input.status === 'pending_review') return 'KYB case opened';
  // No Workflow decides a failed business inquiry: the team takes it from here.
  if (input.status === 'failed')
    return 'Verification failed — terminal for an organization, the team takes it from here';
  return LABELS[input.status];
}

/**
 * Names the flow, the move, the user (id and email), the inquiry and, for an
 * organization, the KYB case and its raw status; the names and documents
 * stay in Persona. A raw case move that changed no status is its own line.
 */
export function formatOperatorMessage(input: Parameters<OperatorMessenger['send']>[0]): string {
  const { userId, email, inquiryId, accountType } = input;

  return [
    `<b>${accountType === 'organization' ? 'KYB' : 'KYC'} Verification</b>`,
    '',
    `<b>Status:</b> ${escapeHtml(statusLine(input))}`,
    `<b>User:</b> ${escapeHtml(userId)}`,
    `<b>Email:</b> ${email ? escapeHtml(email) : 'unknown (profile gone)'}`,
    `<b>Inquiry:</b> ${escapeHtml(inquiryId)}`,
    ...(input.case ? [`<b>Case:</b> ${escapeHtml(input.case.id)} (${escapeHtml(input.case.status)})`] : [])
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
