import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';

import { organizations } from '@/server/organizations';
import { parseOrganizationJob } from '@/server/organizations/organization-outbox';

import { QSTASH_NON_RETRYABLE, withQstashSignature } from '@/lib/qstash';
import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

// A QStash receiver, transport only: delivery lives in the Organizations module.
// 200 for sent or skipped, 500 for a job that beat its row or a failed send so it
// retries, 489 for a body the outbox never produced so it does not.
const handler = async (req: NextRequest) => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', 'organization-job');

  const body = await handlePromise(req.json() as Promise<unknown>);
  const job = parseOrganizationJob(body.res);
  if (!job) throw new ApiError({ message: 'Invalid request payload', capture: true, ...QSTASH_NON_RETRYABLE });

  const outcome = await organizations.deliver({ job });
  if (outcome === 'retry') {
    throw new ApiError({ message: 'The invitation has not caught up with this job', status: 500, capture: false });
  }
  return NextResponse.json({ success: true, data: outcome });
};

export const POST = withQstashSignature(async (req: NextRequest) => {
  return withErrorHandler('Error delivering an organization job', handler)(req);
});
