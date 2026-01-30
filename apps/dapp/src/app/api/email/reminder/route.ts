import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { z } from 'zod';

import { qstash } from '@/server/clients/qstash';
import { getUserEmailProfile } from '@/server/data/auth';
import { BASE_URL } from '@/server/utils/base-url';
import { sendFirstOnboardingReminderEmail, sendSecondOnboardingReminderEmail } from '@/server/utils/send-email';

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
    Sentry.captureMessage('Reminder email skipped: user/profile not found', {
      level: 'info',
      tags: { source: 'API', flow: 'reminder-email' },
      extra: { userId, reminderNumber }
    });

    return NextResponse.json({ success: true, data: 'User or profile not found, skipping reminder' });
  }

  const sendEmail = reminderNumber === 1 ? sendFirstOnboardingReminderEmail : sendSecondOnboardingReminderEmail;

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
    await qstash.publishJSON({
      url: `${BASE_URL}/api/email/reminder`,
      body: { userId, reminderNumber: 2 },
      delay: '7d',
      retries: 3,
      deduplicationId: `onboarding-reminder-10day-${userId}`,
      failureCallback: `${BASE_URL}/api/qstash/failure`
    });
  }

  return NextResponse.json({ success: true, data: `Reminder ${reminderNumber} email sent` });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error sending reminder email', handler)(req);
});
