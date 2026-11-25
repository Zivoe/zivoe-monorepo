import 'server-only';

import { type Client } from '@upstash/qstash';
import { z } from 'zod';

import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';

import { type OrganizationJob, type OrganizationOutbox } from './organizations';

export const ORGANIZATION_JOB_PATH = '/api/organizations/job';

const jobSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('invitation_email'),
    invitationId: z.string().uuid(),
    sendCount: z.number().int().min(1)
  }),
  z.object({ kind: z.literal('organization_created_ops'), organizationId: z.string().uuid() }),
  z.object({ kind: z.literal('member_removed_email'), removalId: z.string().uuid() })
]);

/** Null for a body this outbox did not produce: a contract bug, which a retry cannot fix. */
export const parseOrganizationJob = (body: unknown): OrganizationJob | null => {
  const parsed = jobSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
};

/**
 * A few seconds' hold: an invitation's job is queued inside the transaction that
 * writes the row, and QStash can deliver before that commits. No deduplication
 * id: delivery re-reads the row, and Resend's idempotency key holds the send to one.
 */
const SETTLE_DELAY = '5s';

/**
 * Most of the organization's jobs are queued inside a transaction that holds its row lock: a publish that
 * hangs must not hold it, and a pooled connection, for long. Past this it counts as refused and the
 * transaction rolls back. A publish that lands later after all finds no row: delivery retries it until
 * QStash gives up, and the failure callback reports it, so a timeout shows up once in Sentry. Nothing is
 * sent for it.
 */
const PUBLISH_DEADLINE_MS = 5_000;

export function createQstashOrganizationOutbox({
  qstash,
  baseUrl
}: {
  qstash: Client;
  baseUrl: string;
}): OrganizationOutbox {
  return {
    async enqueue(job) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Queueing the organization job timed out')), PUBLISH_DEADLINE_MS);
      });
      try {
        await Promise.race([
          qstash.publishJSON({
            url: `${baseUrl}${ORGANIZATION_JOB_PATH}`,
            delay: SETTLE_DELAY,
            body: job,
            retries: 3,
            failureCallback: getQstashFailureCallback(baseUrl),
            label: QSTASH_JOB_LABELS.organizationJob
          }),
          deadline
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
