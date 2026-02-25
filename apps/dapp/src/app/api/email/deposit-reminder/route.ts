import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { z } from 'zod';

import { qstash } from '@/server/clients/qstash';
import { getUserEmailProfile } from '@/server/data/auth';
import { hasUserDeposited } from '@/server/data/ponder';
import { BASE_URL } from '@/server/utils/base-url';
import { sendFirstDepositReminderEmail, sendSecondDepositReminderEmail } from '@/server/utils/send-email';

import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

const bodySchema = z.object({
  userId: z.string().uuid(),
  reminderNumber: z.union([z.literal(1), z.literal(2)])
});

type Body = z.infer<typeof bodySchema>;

const handler = async (req: NextRequest) => {
  const body = await handlePromise(req.json() as Promise<Body>);
  if (body.err || !body.res) throw new ApiError({ message: 'Request body not found', status: 400, capture: false });

  const parsedBody = bodySchema.safeParse(body.res);
  if (!parsedBody.success) throw new ApiError({ message: 'Invalid request payload', status: 400, capture: false });

  const { userId, reminderNumber } = parsedBody.data;
  const profile = await getUserEmailProfile(userId);

  if (!profile || !profile.createdAt || !profile.accountType) {
    Sentry.captureException(new Error('Deposit reminder email skipped: user/profile not found'), {
      tags: { source: 'API', flow: 'deposit-reminder-email' },
      extra: { userId, reminderNumber }
    });

    return NextResponse.json({ success: true, data: 'User or profile not found, skipping reminder' });
  }

  const hasDeposited = await hasUserDeposited(userId);
  if (hasDeposited) return NextResponse.json({ success: true, data: 'User has already deposited, skipping reminder' });

  const sendEmail = reminderNumber === 1 ? sendFirstDepositReminderEmail : sendSecondDepositReminderEmail;

  const { err } = await handlePromise(
    sendEmail({
      to: profile.email,
      name: profile.firstName || profile.lastName || undefined,
      accountType: profile.accountType,
      userId
    })
  );

  if (err)
    throw new ApiError({ message: 'Failed to send reminder email', status: 500, exception: err, capture: false });

  // After sending reminder 1, schedule reminder 2 (7 days later = 10 days from onboarding)
  if (reminderNumber === 1) {
    const { err: scheduleErr } = await handlePromise(
      qstash.publishJSON({
        url: `${BASE_URL}/api/email/deposit-reminder`,
        body: { userId, reminderNumber: 2 },
        delay: '7d',
        retries: 3,
        deduplicationId: `deposit-reminder-10day-${userId}`,
        failureCallback: `${BASE_URL}/api/qstash/failure`
      })
    );

    if (scheduleErr) {
      Sentry.captureException(scheduleErr, {
        tags: { source: 'API', flow: 'deposit-reminder-email' },
        extra: { userId, reminderNumber: 2 }
      });
    }
  }

  return NextResponse.json({ success: true, data: `Reminder ${reminderNumber} email sent` });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error sending deposit reminder email', handler)(req);
});
