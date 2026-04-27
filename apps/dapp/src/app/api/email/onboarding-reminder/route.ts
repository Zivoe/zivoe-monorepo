import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

import { getUserEmailProfile } from '@/server/data/auth';
import { isEmailPreferenceEnabled } from '@/server/data/email-preferences';
import { sendOnboardingReminderEmail } from '@/server/utils/send-email';

import { withQstashSignature } from '@/lib/qstash';
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

  // User not found (deleted?)
  if (!profile) {
    Sentry.captureMessage('Signup reminder skipped: user not found', {
      level: 'warning',
      tags: { source: 'API', flow: 'signup-reminder' },
      extra: { userId }
    });

    return NextResponse.json({ success: true, data: 'User not found, skipping signup reminder' });
  }

  // User already onboarded - no need to send reminder
  if (profile.createdAt) {
    return NextResponse.json({ success: true, data: 'User already onboarded, skipping signup reminder' });
  }

  const isProductTipsEnabled = await isEmailPreferenceEnabled({
    userId,
    bucket: 'product_tips'
  });

  if (!isProductTipsEnabled) {
    return NextResponse.json({ success: true, data: 'Product tips disabled, skipping signup reminder' });
  }

  // User hasn't onboarded - send reminder
  const { err } = await handlePromise(
    sendOnboardingReminderEmail({
      to: profile.email,
      name: profile.firstName ?? profile.lastName ?? undefined,
      userId
    })
  );

  if (err)
    throw new ApiError({
      message: 'Failed to send signup reminder email',
      status: 500,
      exception: err,
      capture: false
    });

  return NextResponse.json({ success: true, data: 'Signup reminder email sent' });
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error sending signup reminder email', handler)(req);
});
