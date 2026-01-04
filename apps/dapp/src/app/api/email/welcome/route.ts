import { NextRequest, NextResponse } from 'next/server';

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

  const result = await authDb
    .select({
      email: schema.user.email,
      firstName: schema.profile.firstName,
      lastName: schema.profile.lastName,
      onboardedAt: schema.profile.onboardedAt
    })
    .from(schema.user)
    .leftJoin(schema.profile, eq(schema.user.id, schema.profile.id))
    .where(eq(schema.user.id, userId))
    .limit(1);

  const userData = result[0];

  // User was deleted before welcome email was sent - gracefully skip
  if (!userData) {
    return NextResponse.json({ success: true, data: 'User not found, skipping welcome email' });
  }

  // Only send if user has completed onboarding
  if (!userData.onboardedAt) {
    return NextResponse.json({ success: true, data: 'User not onboarded, skipping welcome email' });
  }

  const { err } = await handlePromise(
    sendWelcomeEmail({
      to: userData.email,
      name: [userData.firstName, userData.lastName].filter(Boolean).join(' ') || undefined,
      userId
    })
  );
  if (err) throw new ApiError({ message: 'Failed to send welcome email', status: 500, exception: err });

  return NextResponse.json({ success: true, data: 'Welcome email sent' });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error sending welcome email', handler)(req) as unknown as NextResponse;
});
