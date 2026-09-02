import 'server-only';

import { and, eq } from 'drizzle-orm';

import { getShareClassIdentity } from '@zivoe/centrifuge-indexer';
import { transactionEmailSent, user } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';
import { isEmailPreferenceEnabled } from '@/server/data/email-preferences';
import { BASE_URL } from '@/server/utils/base-url';
import { sendTransactionReceiptEmail } from '@/server/utils/send-email';

import { ACTIVE_ENVIRONMENT } from '@/lib/chains';

import { type TransactionReceiptJob } from './centrifuge-tx-receipt-job';

/**
 * The Receipt Mailer: one QStash job in, at most one receipt email out.
 * Everything that decides whether the email goes lives here — the recipient
 * read fresh from the user row (never from the queue payload), the
 * transaction_receipts preference gate, and the per-(event, user) dedupe
 * against transactionEmailSent. The send precedes the record on purpose: a
 * crash between them re-sends on retry, and Resend's idempotency key eats
 * the duplicate — the mirror of the Monitor Pass's send-then-record order.
 * That key lives 24 hours: a job re-driven later than that (a DLQ replay
 * days on) with no row recorded sends again, which is the accepted edge.
 */

export type ReceiptMailerResult =
  | { outcome: 'sent' }
  | { outcome: 'skipped'; reason: 'user_not_found' | 'preference_disabled' | 'already_sent' };

export async function runReceiptMailer(job: TransactionReceiptJob): Promise<ReceiptMailerResult> {
  const recipientRows = await db.select({ email: user.email }).from(user).where(eq(user.id, job.userId)).limit(1);
  const recipient = recipientRows[0];
  // A deleted account between enqueue and delivery is a normal end state,
  // not an error — the wallet link died with the user row.
  if (!recipient) return { outcome: 'skipped', reason: 'user_not_found' };

  const receiptsEnabled = await isEmailPreferenceEnabled({ userId: job.userId, bucket: 'transaction_receipts' });
  if (!receiptsEnabled) return { outcome: 'skipped', reason: 'preference_disabled' };

  const alreadySent = await db
    .select({ id: transactionEmailSent.id })
    .from(transactionEmailSent)
    .where(and(eq(transactionEmailSent.eventId, job.eventId), eq(transactionEmailSent.userId, job.userId)))
    .limit(1);
  if (alreadySent.length > 0) return { outcome: 'skipped', reason: 'already_sent' };

  // The runtime trust boundary for the payload's share-class key: an unknown
  // or retired key throws, which sends the job to the DLQ instead of mailing
  // a receipt this deployment cannot describe.
  const identity = getShareClassIdentity({ environment: ACTIVE_ENVIRONMENT, key: job.shareClassKey });

  await sendTransactionReceiptEmail({
    to: recipient.email,
    userId: job.userId,
    job,
    symbol: identity.symbol,
    shareDecimals: identity.decimals,
    viewInAppUrl: `${BASE_URL}/vaults/${job.zivoeVaultSlug}`
  });

  await db
    .insert(transactionEmailSent)
    .values({
      eventId: job.eventId,
      txHash: job.event.txHash,
      userId: job.userId,
      walletAddress: job.event.account,
      eventType: job.event.type
    })
    .onConflictDoNothing();

  return { outcome: 'sent' };
}
