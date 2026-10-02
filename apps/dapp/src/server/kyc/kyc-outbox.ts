import 'server-only';

import { type Client } from '@upstash/qstash';
import { z } from 'zod';

import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';

import { isKycEmailStatus, isKycOperatorStatus } from './kyc-status';
import { type KycNotification, type Outbox } from './kyc-verification';

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
  statusChangedAt: z.string().datetime({ offset: true })
});

/**
 * Null when the body is not a job this outbox produced for that channel — a
 * contract bug, which a retry cannot fix and the route answers as such.
 */
export function parseKycNotificationJob({
  kind,
  body
}: {
  kind: KycNotification['kind'];
  body: unknown;
}): KycNotification | null {
  const parsed = jobBodySchema.safeParse(body);
  if (!parsed.success) return null;

  const { userId, inquiryId, status } = parsed.data;
  const statusChangedAt = new Date(parsed.data.statusChangedAt);
  if (kind === 'status_email') {
    return isKycEmailStatus(status) ? { kind, userId, inquiryId, status, statusChangedAt } : null;
  }
  return isKycOperatorStatus(status) ? { kind, userId, inquiryId, status, statusChangedAt } : null;
}

/**
 * How long the `pending_review` email waits before QStash delivers it. Review
 * is the one emailable status the investor cannot act on, and a review that
 * resolves quickly would otherwise send "under review" and "you're verified"
 * back to back. Held for this long, a fast decision leaves the record past
 * the job and the receiver's directional check drops it — so a quick review
 * sends one email, a slow one still sets expectations. The operator message
 * for the same transition is not held: that is who can clear the review.
 */
const PENDING_REVIEW_EMAIL_DELAY = '30m';
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
          statusChangedAt: notification.statusChangedAt.toISOString()
        },
        retries: 3,
        failureCallback: getQstashFailureCallback(baseUrl),
        label: isEmail ? QSTASH_JOB_LABELS.emailKycStatus : QSTASH_JOB_LABELS.telegramKyc
      });
    }
  };
}
