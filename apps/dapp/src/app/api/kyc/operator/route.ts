import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

import { sendTelegramMessage } from '@/server/utils/send-telegram';
import { verification } from '@/server/verification';
import { type OperatorChange } from '@/server/verification/verification';

import { QSTASH_NON_RETRYABLE, withQstashSignature } from '@/lib/qstash';
import { ApiError, escapeHtml, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

const FLOW = 'kyc-operator';

const bodySchema = z.object({ action: z.enum(['revoke', 'approve', 'resync']), userId: z.string().uuid() });

// An operator's action on one user's verification, published through QStash
// by `pnpm kyc:operator` — whoever holds the QStash token is the operator.
// `revoke` and `approve` set the Human-owned `revoked` and `manually_approved`;
// `resync` re-reads the user from Persona whatever the record says, which is
// how either is lifted. QStash carries no response back, so every outcome is
// posted to the Persona Telegram channel: that line is the operator's answer
// and the audit trail.
const handler = async (req: NextRequest): ApiResponse<OperatorChange> => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', FLOW);

  const body = bodySchema.safeParse((await handlePromise(req.json() as Promise<unknown>)).res);
  if (!body.success) throw new ApiError({ message: 'Invalid request payload', capture: true, ...QSTASH_NON_RETRYABLE });
  const { action, userId } = body.data;

  // A failed send must not fail the action: a retry would run it again and report "unchanged".
  const report = async (lines: Array<string>) => {
    const { err } = await handlePromise(
      sendTelegramMessage({
        chatId: env.TELEGRAM_PERSONA_CHAT_ID,
        text: [
          '<b>Verification operator action</b>',
          '',
          `<b>Action:</b> ${action}`,
          `<b>User:</b> ${escapeHtml(userId)}`,
          ...lines
        ].join('\n')
      })
    );
    if (err) Sentry.captureException(err, { tags: { source: 'API', flow: FLOW }, extra: { action, userId } });
  };

  const result =
    action === 'revoke'
      ? await verification.revoke({ userId })
      : action === 'approve'
        ? await verification.approveManually({ userId })
        : await verification.resyncFromPersona({ userId });

  if (!result.ok) {
    switch (result.error.code) {
      case 'profile_missing':
        await report(['<b>Result:</b> refused — no onboarded user has this id']);
        throw new ApiError({ message: 'No onboarded user has this id', capture: false, ...QSTASH_NON_RETRYABLE });
      case 'conflict':
        throw new ApiError({ message: 'The record changed under the operator action', status: 500, capture: false });
      case 'persona_unavailable':
        throw new ApiError({ message: 'Persona could not be read', status: 500, exception: result.error.cause });
    }
  }

  const { from, to, inquiryId, path, case: kybCase } = result.value;
  const noInquiry = action === 'resync' ? 'none in Persona — the record was left as it is' : 'none';
  // The record stops hearing Persona, which an Inquiry is still decided in —
  // unless nothing in Persona decides it: an organization's failed inquiry.
  const overridesPersona = action === 'approve' && !!inquiryId && !(path === 'organization' && from === 'failed');
  await report([
    `<b>Status:</b> ${from === to ? `${to} (unchanged)` : `${from} → ${to}`}`,
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
  ]);

  return NextResponse.json({ success: true, data: result.value });
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error running KYC operator action', handler)(req);
});
