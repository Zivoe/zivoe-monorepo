import { NextRequest, NextResponse } from 'next/server';

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { z } from 'zod';

import { getUserEmailProfile } from '@/server/data/auth';
import { sendReminderEmail } from '@/server/utils/send-email';

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
    return NextResponse.json({ success: true, data: 'User or profile not found, skipping reminder' });
  }

  const { err } = await handlePromise(
    sendReminderEmail({
      to: profile.email,
      name: profile.firstName || profile.lastName || undefined,
      userId
    })
  );

  if (err)
    throw new ApiError({ message: 'Failed to send reminder email', status: 500, exception: err, capture: false });

  return NextResponse.json({ success: true, data: 'Reminder email sent' });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error sending reminder email', handler)(req);
});
