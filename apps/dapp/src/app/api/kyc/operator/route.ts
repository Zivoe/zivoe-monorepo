import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { organization } from '@zivoe/database/schema';

import { db } from '@/server/clients/db';
import { organizationLabel, statusLabel } from '@/server/utils/operator-labels';
import { sendTelegramMessage } from '@/server/utils/send-telegram';
import { verification } from '@/server/verification';
import { type OperatorChange } from '@/server/verification/verification';

import { QSTASH_NON_RETRYABLE, withQstashSignature } from '@/lib/qstash';
import { ApiError, escapeHtml, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

const FLOW = 'kyc-operator';

const bodySchema = z.object({ action: z.enum(['revoke', 'approve', 'resync']), subjectId: z.string().uuid() });

// An operator's action on one subject's verification, published through QStash
// by `pnpm kyc:operator` — whoever holds the QStash token is the operator.
// `revoke` and `approve` set the Human-owned `revoked` and `manually_approved`;
// `resync` re-reads the subject from Persona whatever the record says, which is
// how either is lifted. QStash carries no response back, so every outcome is
// posted to the Persona Telegram channel: that line is the operator's answer
// and the audit trail. Members take each other out of an organization in the
// app (Settings → Members).
const handler = async (req: NextRequest): ApiResponse<OperatorChange> => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', FLOW);

  const body = bodySchema.safeParse((await handlePromise(req.json() as Promise<unknown>)).res);
  if (!body.success) throw new ApiError({ message: 'Invalid request payload', capture: true, ...QSTASH_NON_RETRYABLE });

  const { action, subjectId } = body.data;

  // A failed send must not fail the action: a retry would run it again and report "unchanged".
  // `who` names the id once the action has read it; "Subject" for an id that is nobody's.
  const report = async (lines: Array<string>, who = `<b>Subject:</b> ${escapeHtml(subjectId)}`) => {
    const { err } = await handlePromise(
      sendTelegramMessage({
        chatId: env.TELEGRAM_PERSONA_CHAT_ID,
        text: ['<b>Verification operator action</b>', '', `<b>Action:</b> ${action}`, who, ...lines].join('\n')
      })
    );
    if (err) Sentry.captureException(err, { tags: { source: 'API', flow: FLOW }, extra: { action, subjectId } });
  };

  const result =
    action === 'revoke'
      ? await verification.revoke({ subjectId })
      : action === 'approve'
        ? await verification.approveManually({ subjectId })
        : await verification.resyncFromPersona({ subjectId });

  if (!result.ok) {
    switch (result.error.code) {
      case 'subject_missing':
        await report(['<b>Result:</b> refused: no person or organization has this id']);
        throw new ApiError({
          message: 'No person or organization has this id',
          capture: false,
          ...QSTASH_NON_RETRYABLE
        });
      case 'conflict':
        throw new ApiError({ message: 'The record changed under the operator action', status: 500, capture: false });
      case 'persona_unavailable':
        throw new ApiError({ message: 'Persona could not be read', status: 500, exception: result.error.cause });
    }
  }

  const { from, to, inquiryId, path, case: kybCase } = result.value;
  const noInquiry = action === 'resync' ? 'none in Persona, so the record was left as it is' : 'none';
  // The record stops hearing Persona, which an Inquiry is still decided in —
  // unless nothing in Persona decides it: an organization's failed inquiry.
  const overridesPersona = action === 'approve' && !!inquiryId && !(path === 'organization' && from === 'failed');
  const who =
    path === 'organization'
      ? `<b>Organization:</b> ${await organizationLine(subjectId)}`
      : `<b>Person:</b> ${escapeHtml(subjectId)}`;
  await report(
    [
      `<b>Status:</b> ${from === to ? `${statusLabel(to)} (unchanged)` : `${statusLabel(from)} → ${statusLabel(to)}`}`,
      `<b>Inquiry:</b> ${inquiryId ? escapeHtml(inquiryId) : noInquiry}`,
      ...(kybCase ? [`<b>Case:</b> ${escapeHtml(kybCase.id)} (${escapeHtml(kybCase.status)})`] : []),
      ...(overridesPersona
        ? [
            '',
            path !== 'organization'
              ? '⚠️ This user has an Inquiry: Persona is ignored from here on. Decide it in Persona and resync instead.'
              : kybCase
                ? '⚠️ This organization has a KYB case: Persona is ignored from here on. Decide the case in Persona and resync instead.'
                : '⚠️ This organization has a business inquiry and no KYB case yet: Persona is ignored from here on. When the case is decided, resync.'
          ]
        : [])
    ],
    who
  );

  return NextResponse.json({ success: true, data: result.value });
};

/** The organization as every operator message names it; its bare id when it can't be read, so the reply still goes. */
async function organizationLine(organizationId: string) {
  const { res } = await handlePromise(
    db
      .select({ name: organization.name, deletedAt: organization.deletedAt })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1)
  );
  const row = res?.[0];
  return row
    ? organizationLabel({ name: row.name, id: organizationId, deleted: row.deletedAt !== null })
    : escapeHtml(organizationId);
}

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error running KYC operator action', handler)(req);
});
