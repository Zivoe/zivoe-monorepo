import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { z } from 'zod';

import { qstash } from '@/server/clients/qstash';
import { getUserEmailProfile } from '@/server/data/auth';
import { BASE_URL } from '@/server/utils/base-url';
import { sendWelcomeEmail } from '@/server/utils/send-email';

import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

const bodySchema = z.object({
  userId: z.string().uuid()
});

type Body = z.infer<typeof bodySchema>;

const handler = async (req: NextRequest) => {
  const body = await handlePromise(req.json() as Promise<Body>);
  if (body.err || !body.res) throw new ApiError({ message: 'Request body not found', status: 400, capture: false });

  const parsedBody = bodySchema.safeParse(body.res);
  if (!parsedBody.success) throw new ApiError({ message: 'Invalid request payload', status: 400, capture: false });

  const { userId } = parsedBody.data;

  const profile = await getUserEmailProfile(userId);

  if (!profile || !profile.createdAt) {
    throw new ApiError({ message: 'Profile not found or deleted', status: 500, capture: false });
  }

  const { err } = await handlePromise(
    sendWelcomeEmail({
      to: profile.email,
      name: profile.firstName || profile.lastName || undefined,
      userId
    })
  );

  if (err) throw new ApiError({ message: 'Failed to send welcome email', status: 500, exception: err, capture: false });

  // Schedule first deposit reminder (3 days after welcome email)
  const { err: scheduleErr } = await handlePromise(
    qstash.publishJSON({
      url: `${BASE_URL}/api/email/deposit-reminder`,
      body: { userId, reminderNumber: 1 },
      delay: '3d',
      retries: 3,
      deduplicationId: `deposit-reminder-3day-${userId}`,
      failureCallback: `${BASE_URL}/api/qstash/failure`
    })
  );

  if (scheduleErr) {
    Sentry.captureException(scheduleErr, {
      tags: { source: 'API', flow: 'welcome-email' },
      extra: { userId, reminderNumber: 1 }
    });
  }

  return NextResponse.json({ success: true, data: 'Welcome email sent' });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error sending welcome email', handler)(req);
});
