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

  const { err: profileErr, res: profileRes } = await handlePromise(
    authDb
      .select({
        email: schema.user.email,
        firstName: schema.profile.firstName,
        lastName: schema.profile.lastName,
        createdAt: schema.profile.createdAt
      })
      .from(schema.user)
      .leftJoin(schema.profile, eq(schema.user.id, schema.profile.id))
      .where(eq(schema.user.id, userId))
      .limit(1)
  );

  if (profileErr) {
    throw new ApiError({ message: 'Failed to query user profile', status: 500, exception: profileErr, capture: false });
  }

  const profile = profileRes?.[0];

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

  return NextResponse.json({ success: true, data: 'Welcome email sent' });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error sending welcome email', handler)(req) as unknown as NextResponse;
});
