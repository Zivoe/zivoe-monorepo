import 'server-only';

import { type Client } from '@upstash/qstash';
import { z } from 'zod';

import { verificationStatusValues } from '@zivoe/database/kyc';

import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';

import { type Outbox, type VerificationNotification } from './verification';
import {
  DECISION_STATUSES,
  isOneOf,
  isVerificationEmailStatus,
  isVerificationOperatorStatus
} from './verification-status';

export const KYC_STATUS_EMAIL_PATH = '/api/email/kyc-status';
export const KYC_OPERATOR_MESSAGE_PATH = '/api/telegram/kyc';

/**
 * The wire shape of one queued notification: what the adapter publishes and
 * what a receiver route hands back to `deliverNotification`. `kind` does not
 * travel — each channel has its own route, and the route names it.
 */
const jobBodySchema = z.object({
  userId: z.string().uuid(),
  inquiryId: z.string().min(1),
  status: z.string(),
  /** The transition this job announces, on Persona's clock. */
  statusChangedAt: z.string().datetime({ offset: true }),
  /** Both present on a raw KYB case move; absent on every other job, including those queued before they existed. */
  caseId: z.string().min(1).optional(),
  caseStatus: z.string().min(1).optional(),
  /** Present on a reopen's or a reversal's email and operator jobs; absent on every other job, including those queued before it existed. */
  previousDecision: z.enum(DECISION_STATUSES).optional()
});

const isVerificationStatus = isOneOf(verificationStatusValues);

/**
 * Null when the body is not a job this outbox produced for that channel — a
 * contract bug, which a retry cannot fix and the route answers as such.
 */
export function parseVerificationNotificationJob({
  kind,
  body
}: {
  kind: VerificationNotification['kind'];
  body: unknown;
}): VerificationNotification | null {
  const parsed = jobBodySchema.safeParse(body);
  if (!parsed.success) return null;

  const { userId, inquiryId, status, caseId, caseStatus, previousDecision } = parsed.data;
  const statusChangedAt = new Date(parsed.data.statusChangedAt);
  const reopen = previousDecision ? { previousDecision } : {};
  if (kind === 'status_email') {
    return isVerificationEmailStatus(status)
      ? { kind: 'status_email', userId, inquiryId, status, statusChangedAt, ...reopen }
      : null;
  }
  // The operator channel carries both a transition and a raw case move.
  if (caseId && caseStatus) {
    return isVerificationStatus(status)
      ? { kind: 'case_status', userId, inquiryId, status, statusChangedAt, caseId, caseStatus }
      : null;
  }
  return isVerificationOperatorStatus(status)
    ? { kind: 'operator_message', userId, inquiryId, status, statusChangedAt, ...reopen }
    : null;
}

/**
 * How long the `pending_review` email waits before QStash delivers it. Not
 * to swallow a fast decision — after a review starts only a person decides,
 * and the investor should hear at once, a reopen above all — but to let the
 * KYB case settle: the Workflow creates it at Open and moves it to Waiting
 * on UBOs a fraction of a second later, as a second webhook, and the email
 * picks its words (the owners' turn or the team's) from the record when it
 * is sent.
 */
const PENDING_REVIEW_EMAIL_DELAY = '1m';
/**
 * Every other job waits a few seconds. The write path enqueues before it
 * persists (so a failed persist is retried, not silently unnotified), and
 * QStash delivers within about a second — faster than the persist that
 * follows the enqueue lands. Without a hold the receiver's first read finds
 * the record behind the job, answers 500, and QStash retries twelve seconds
 * later: every notification late, every first delivery an error.
 */
const SETTLE_DELAY = '5s';

/**
 * The Outbox port over QStash. Each notification becomes one job to the
 * receiver route for its channel. No QStash deduplication id on purpose:
 * QStash remembers them for 90 days, which would silently drop the
 * re-enqueue the write path relies on after a failed persist. Idempotency is
 * `deliverNotification`'s job — it re-reads the record — and the channel's,
 * which keys the send.
 */
export function createQstashOutbox({ qstash, baseUrl }: { qstash: Client; baseUrl: string }): Outbox {
  return {
    async enqueue(notification) {
      const isEmail = notification.kind === 'status_email';

      await qstash.publishJSON({
        url: `${baseUrl}${isEmail ? KYC_STATUS_EMAIL_PATH : KYC_OPERATOR_MESSAGE_PATH}`,
        delay: isEmail && notification.status === 'pending_review' ? PENDING_REVIEW_EMAIL_DELAY : SETTLE_DELAY,
        body: {
          userId: notification.userId,
          inquiryId: notification.inquiryId,
          status: notification.status,
          statusChangedAt: notification.statusChangedAt.toISOString(),
          ...(notification.kind === 'case_status'
            ? { caseId: notification.caseId, caseStatus: notification.caseStatus }
            : {}),
          ...(notification.kind !== 'case_status' && notification.previousDecision
            ? { previousDecision: notification.previousDecision }
            : {})
        },
        retries: 3,
        failureCallback: getQstashFailureCallback(baseUrl),
        label: isEmail ? QSTASH_JOB_LABELS.emailKycStatus : QSTASH_JOB_LABELS.telegramKyc
      });
    }
  };
}
