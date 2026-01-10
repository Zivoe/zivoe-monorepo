import { NextRequest, NextResponse } from 'next/server';

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { authDb } from '@/server/clients/auth-db';
import { profile } from '@/server/db/schema';
import { sendTelegramMessage } from '@/server/utils/send-telegram';

import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

const bodySchema = z
  .object({
    userId: z.string().uuid()
  })
  .passthrough();

const handler = async (req: NextRequest) => {
  const body = await handlePromise(req.json() as Promise<Record<string, unknown>>);
  if (body.err || !body.res) throw new ApiError({ message: 'Request body not found', status: 400, capture: false });

  const parsedBody = bodySchema.safeParse(body.res);
  if (!parsedBody.success) throw new ApiError({ message: 'Invalid request payload', status: 400, capture: false });

  // * If we start getting duplicates QStash messages
  // * Implement Redis-based idempotency using Upstash-Message-Id header

  const { err: profileErr, res: profileRes } = await handlePromise(
    authDb
      .select({ id: profile.id, createdAt: profile.createdAt })
      .from(profile)
      .where(eq(profile.id, parsedBody.data.userId))
      .limit(1)
  );

  if (profileErr) {
    throw new ApiError({ message: 'Failed to query user profile', status: 500, exception: profileErr, capture: false });
  }

  const profileData = profileRes?.[0];

  if (!profileData || !profileData.createdAt) {
    throw new ApiError({ message: 'Profile not found or deleted', status: 500, capture: false });
  }

  const { err } = await handlePromise(sendTelegramMessage({ text: formatOnboardingMessage(parsedBody.data) }));
  if (err)
    throw new ApiError({
      message: 'Failed to send Telegram notification',
      status: 500,
      exception: err,
      capture: false
    });

  return NextResponse.json({ success: true, data: 'Telegram notification sent' });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error sending Telegram notification', handler)(req);
});

const MAX_MESSAGE_LENGTH = 4096;

function formatOnboardingMessage(data: Record<string, unknown>): string {
  const lines = ['<b>New User Onboarded</b>', ''];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      lines.push(`<b>${formatLabel(key)}:</b> ${escapeHtml(String(value))}`);
    }
  }

  const message = lines.join('\n');

  if (message.length > MAX_MESSAGE_LENGTH) {
    return message.slice(0, MAX_MESSAGE_LENGTH - 3) + '...';
  }

  return message;
}

function escapeHtml(text: string): string {
  const entities: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };
  return text.replace(/[<>&]/g, (c) => entities[c] ?? c);
}

function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // acronyms: userID → user ID
    .replace(/^./, (s) => s.toUpperCase()); // Capitalize first letter
}
