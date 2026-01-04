import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { authDb } from '@/server/clients/auth-db';
import * as schema from '@/server/db/schema';
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

  // TODO: Check onboarding data after implementing it...
  const user = await authDb.query.user.findFirst({
    where: eq(schema.user.id, userId)
  });

  // User was deleted before welcome email was sent - gracefully skip
  if (!user) {
    return NextResponse.json({ success: true, data: 'User not found, skipping welcome email' });
  }

  const { err } = await handlePromise(sendWelcomeEmail({ to: user.email, name: user.name ?? undefined, userId }));

  if (err) {
    Sentry.captureException(err, {
      tags: { source: 'SERVER', flow: 'welcome-email' },
      extra: { userId }
    });

    throw new ApiError({ message: 'Failed to send welcome email', status: 500, exception: err });
  }

  return NextResponse.json({ success: true, data: 'Welcome email sent' });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error sending welcome email', handler)(req) as unknown as NextResponse;
});
