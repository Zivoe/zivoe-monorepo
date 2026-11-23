import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { and, eq, isNull } from 'drizzle-orm';

import { getShareClassIdentity } from '@zivoe/centrifuge-indexer';
import {
  organization,
  organizationMember,
  transactionEmailSent,
  user,
  walletConnection,
  walletLink
} from '@zivoe/database/schema';

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
  | { outcome: 'skipped'; reason: 'user_not_found' | 'no_longer_member' | 'preference_disabled' | 'already_sent' };

export async function runReceiptMailer(job: TransactionReceiptJob): Promise<ReceiptMailerResult> {
  // A skip leaves no row behind, so the log line is its only trace — enough
  // to answer "why did this user get no receipt" without a DB query.
  const skip = (reason: Extract<ReceiptMailerResult, { outcome: 'skipped' }>['reason']): ReceiptMailerResult => {
    Sentry.logger.info('transaction-receipt-email skipped', { eventId: job.eventId, userId: job.userId, reason });
    return { outcome: 'skipped', reason };
  };

  const recipientRows = await db.select({ email: user.email }).from(user).where(eq(user.id, job.userId)).limit(1);
  const recipient = recipientRows[0];
  // A deleted account between enqueue and delivery is a normal end state,
  // not an error — the wallet link died with the user row.
  if (!recipient) return skip('user_not_found');

  // The organization version was decided when the job was queued. Someone who has left or been
  // removed since, or whose organization is gone, must not hear of its activity; a wallet connection
  // of their own still earns them the plain receipt.
  let receipt = job;
  if (job.organization && !(await isOwningMember({ job, organizationId: job.organization.id }))) {
    if (!(await hasConnected({ userId: job.userId, address: job.event.account }))) return skip('no_longer_member');
    receipt = { ...job, organization: null };
  }

  const receiptsEnabled = await isEmailPreferenceEnabled({ userId: job.userId, bucket: 'transaction_receipts' });
  if (!receiptsEnabled) return skip('preference_disabled');

  const alreadySent = await db
    .select({ id: transactionEmailSent.id })
    .from(transactionEmailSent)
    .where(and(eq(transactionEmailSent.eventId, job.eventId), eq(transactionEmailSent.userId, job.userId)))
    .limit(1);
  if (alreadySent.length > 0) return skip('already_sent');

  // The runtime trust boundary for the payload's share-class key: an unknown
  // or retired key throws, which sends the job to the DLQ instead of mailing
  // a receipt this deployment cannot describe.
  const identity = getShareClassIdentity({ environment: ACTIVE_ENVIRONMENT, key: job.shareClassKey });

  await sendTransactionReceiptEmail({
    to: recipient.email,
    userId: job.userId,
    job: receipt,
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

/** Whether the recipient is still a member of the live organization that has the address linked. */
async function isOwningMember({ job, organizationId }: { job: TransactionReceiptJob; organizationId: string }) {
  const rows = await db
    .select({ id: organizationMember.id })
    .from(organizationMember)
    .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
    .innerJoin(walletLink, eq(walletLink.subjectId, organizationMember.organizationId))
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(organizationMember.userId, job.userId),
        isNull(organization.deletedAt),
        eq(walletLink.address, job.event.account),
        eq(walletLink.status, 'linked')
      )
    )
    .limit(1);
  return rows.length > 0;
}

/** Whether the recipient connected the wallet themselves. Addresses are lowercase on both sides. */
async function hasConnected({ userId, address }: { userId: string; address: string }) {
  const rows = await db
    .select({ userId: walletConnection.userId })
    .from(walletConnection)
    .where(and(eq(walletConnection.userId, userId), eq(walletConnection.address, address)))
    .limit(1);
  return rows.length > 0;
}
