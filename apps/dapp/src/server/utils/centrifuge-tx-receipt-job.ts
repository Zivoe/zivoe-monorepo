import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';

import { INVESTOR_TRANSACTION_EVENT_TYPES } from '@zivoe/centrifuge-indexer';

/**
 * The wire contract between the Transaction Monitor and the Receipt Mailer:
 * one QStash job per (alertable event, linked user). The payload is
 * self-contained — indexer event data is immutable, so the mailer renders
 * from the job instead of re-querying the indexer. Deliberately absent: the
 * recipient's email address (read fresh from the user row at send time, and
 * kept out of the queue's stored payloads) and the share symbol/decimals
 * (resolved through getShareClassIdentity, the runtime trust boundary).
 */

export const TRANSACTION_RECEIPT_JOB_PATH = '/api/email/transaction-receipt';

/**
 * Amounts travel as decimal strings — QStash payloads are JSON, which cannot
 * carry bigint. Unsigned, like the indexer boundary that feeds it: a negative
 * amount is refused there as malformed, and this mirror means no forged or
 * hand-replayed payload can render one as a success receipt either.
 */
const bigintString = z.string().regex(/^\d+$/).transform(BigInt);

export const transactionReceiptJobSchema = z.object({
  /** The Notified Ledger's canonical event id — also the email-side dedupe key. */
  eventId: z.string().min(1),
  userId: z.string().uuid(),
  // Slug-shaped so the CTA URL it lands in cannot be reshaped by a stray
  // `/`, `?` or encoded character.
  zivoeVaultSlug: z.string().regex(/^[a-z0-9-]+$/),
  shareClassKey: z.string().min(1),
  event: z.object({
    type: z.enum(INVESTOR_TRANSACTION_EVENT_TYPES),
    account: z.string().min(1),
    txHash: z.string().min(1),
    chainId: z.number().int().nullable(),
    chainName: z.string().nullable(),
    explorerUrl: z.string().nullable(),
    centrifugeId: z.string(),
    tokenAmount: bigintString.nullable(),
    currencyAmount: bigintString.nullable(),
    createdAtMs: z.number().int()
  })
});

export type TransactionReceiptJob = z.infer<typeof transactionReceiptJobSchema>;
/** The pre-parse JSON shape the monitor publishes (amounts still strings). */
export type TransactionReceiptJobInput = z.input<typeof transactionReceiptJobSchema>;

/**
 * Stable compact key for one (event, user) email — QStash's deduplicationId
 * and Resend's idempotency key both cap out below the canonical eventId's
 * length, so both carry this hash instead.
 */
export function buildReceiptJobKey({ eventId, userId }: { eventId: string; userId: string }): string {
  return createHash('sha256').update(`${eventId}/${userId}`).digest('hex');
}
