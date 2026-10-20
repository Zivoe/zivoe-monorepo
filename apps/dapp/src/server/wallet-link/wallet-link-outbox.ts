import 'server-only';

import { type Client } from '@upstash/qstash';
import { z } from 'zod';

import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';

import { type WalletLinkJob, type WalletLinkOutbox } from './wallet-link';

export const WALLET_LINK_OPERATOR_MESSAGE_PATH = '/api/telegram/wallet-link';
export const WALLET_LINK_WHITELISTED_EMAIL_PATH = '/api/email/wallet-link';

/**
 * The wire shape of one queued job: what the adapter publishes and what a
 * receiver route hands back to `deliverNotification`. Unlike the KYC outbox,
 * `kind` travels: the operator route serves two kinds, so the body must say
 * which transition it announces.
 */
const jobBodySchema = z.object({
  linkId: z.string().uuid(),
  kind: z.string(),
  /** The stamp of the transition — `signedAt`, `removedAt` or `whitelistObservedAt`. */
  at: z.string().datetime({ offset: true })
});

/**
 * Null when the body is not a job this outbox produced for that route — a
 * kind another route serves, or a shape never published. A contract bug,
 * which a retry cannot fix and the route answers as such.
 */
export function parseWalletLinkJob({
  kinds,
  body
}: {
  kinds: ReadonlyArray<WalletLinkJob['kind']>;
  body: unknown;
}): WalletLinkJob | null {
  const parsed = jobBodySchema.safeParse(body);
  if (!parsed.success) return null;

  const kind = kinds.find((candidate) => candidate === parsed.data.kind);
  if (!kind) return null;

  return { linkId: parsed.data.linkId, kind, at: new Date(parsed.data.at) };
}

/**
 * Every job waits a few seconds, for the reason the KYC outbox holds its
 * jobs: the module enqueues before it persists, and QStash delivers faster
 * than the persist that follows lands. Without the hold the receiver's first
 * read finds the row behind the job, answers 500, and every first delivery
 * is an error that QStash retries twelve seconds later.
 */
const SETTLE_DELAY = '5s';

/**
 * The Outbox port over QStash: the operator kinds to the Telegram route, the
 * email kind to the email route. No QStash deduplication id on purpose —
 * QStash remembers them for 90 days, which would silently drop the
 * re-enqueue a failed persist relies on. `deliverNotification` skips a job
 * the row has moved past (it re-reads the row and matches the stamp); a live
 * job delivered twice is the channel's to absorb, which the email's adapter
 * does and Telegram does not.
 */
export function createQstashWalletLinkOutbox({
  qstash,
  baseUrl
}: {
  qstash: Client;
  baseUrl: string;
}): WalletLinkOutbox {
  return {
    async enqueue(job) {
      const isEmail = job.kind === 'whitelisted_email';

      await qstash.publishJSON({
        url: `${baseUrl}${isEmail ? WALLET_LINK_WHITELISTED_EMAIL_PATH : WALLET_LINK_OPERATOR_MESSAGE_PATH}`,
        delay: SETTLE_DELAY,
        body: { linkId: job.linkId, kind: job.kind, at: job.at.toISOString() },
        retries: 3,
        failureCallback: getQstashFailureCallback(baseUrl),
        label: isEmail ? QSTASH_JOB_LABELS.emailWalletLink : QSTASH_JOB_LABELS.telegramWalletLink
      });
    }
  };
}
