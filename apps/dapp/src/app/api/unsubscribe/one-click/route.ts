import { type NextRequest, NextResponse } from 'next/server';

import { resolveUnsubscribeActor, setEmailPreferenceBucketEnabled } from '@/server/data/email-preferences';

import { ApiError, withErrorHandler } from '@/lib/utils';

const handler = async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) throw new ApiError({ message: 'Missing unsubscribe token', status: 400, capture: false });

  const actorResult = await resolveUnsubscribeActor({ token });
  if (actorResult.status !== 'authorized') {
    throw new ApiError({ message: 'Invalid or expired unsubscribe token', status: 400, capture: false });
  }

  if (actorResult.actor.tokenBucket !== 'product_tips') {
    throw new ApiError({ message: 'Unsupported unsubscribe category for one-click', status: 400, capture: false });
  }

  await setEmailPreferenceBucketEnabled({
    userId: actorResult.actor.userId,
    bucket: 'product_tips',
    enabled: false
  });

  return new NextResponse(null, { status: 200 });
};

export const POST = withErrorHandler('Error processing one-click unsubscribe request', handler);
