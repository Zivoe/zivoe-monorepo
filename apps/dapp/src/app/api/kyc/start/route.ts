import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { ipAddress } from '@vercel/functions';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { redis } from '@/server/clients/redis';
import { getOnboardingStep } from '@/server/data/auth';
import { organizations } from '@/server/organizations';
import { verification } from '@/server/verification';
import { isKycEnabled } from '@/server/verification/kyc-flag';
import { takeStartLock } from '@/server/verification/start-lock';
import { type StartVerificationError } from '@/server/verification/verification';

import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

import { type ApiResponseError } from '../../utils';

const FLOW = 'kyc-start';

/** No body starts the person's own verification; an organization's names itself. */
const bodySchema = z.object({ subjectId: z.string().uuid().optional() });

/** The page's typed refusal: the code drives the copy (the page owns the words), never a redirect. */
export type StartVerificationErrorResponse = { error: string; code: StartVerificationError['code'] };
export type StartVerificationSuccessResponse = { success: true; data: { inquiryId: string; sessionToken: string } };
/** Not in the organization asked for, or no longer: told apart from the flag's plain 404, so the page can say so. */
export type StartVerificationNotMemberResponse = { error: string; code: 'not_member' };
/** Everything the route can answer with, including `withErrorHandler`'s generic shape. */
export type StartVerificationResponse =
  | StartVerificationSuccessResponse
  | StartVerificationErrorResponse
  | StartVerificationNotMemberResponse
  | ApiResponseError;

const notMember = () =>
  NextResponse.json<StartVerificationResponse>({ error: 'Not found', code: 'not_member' }, { status: 404 });

// Every inquiry costs money on the Persona bill and a user has one inquiry
// at a time: a tight per-user limit (resumes share it), with a looser IP
// limit backstopping many accounts behind one machine — an office or a VPN
// egress is several investors, each with a few clicks.
const userRatelimit = new Ratelimit({
  redis,
  prefix: 'kyc-start:user',
  limiter: Ratelimit.fixedWindow(5, '10 m')
});
const ipRatelimit = new Ratelimit({
  redis,
  prefix: 'kyc-start:ip',
  limiter: Ratelimit.fixedWindow(30, '10 m')
});

/**
 * One start per subject at a time: two concurrent clicks, or two members of an
 * organization, must not create two billable inquiries. The TTL covers the worst case inside the lock: three
 * Persona calls (a list, then a create retried once), each of which may
 * first wait out a 429 for up to 5 s and then time out at 15 s — 60 s — plus
 * a margin for Redis and the database. The route's own limit matches it.
 */
const START_LOCK_TTL_SECONDS = 75;
export const maxDuration = 75;

const handler = async (req: NextRequest): Promise<NextResponse<StartVerificationResponse>> => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', FLOW);

  const sessionRes = await handlePromise(auth.api.getSession({ headers: req.headers }));
  if (sessionRes.err) {
    throw new ApiError({ message: 'Error verifying session', status: 500, exception: sessionRes.err });
  }

  const user = sessionRes.res?.user;
  if (!user) throw new ApiError({ message: 'Unauthorized', status: 401, capture: false });
  // Behind the `kyc` flag: the route does not exist for anyone it is off for.
  if (!(await isKycEnabled({ user }))) throw new ApiError({ message: 'Not found', status: 404, capture: false });
  // Behind onboarding and the current terms, like the page: a `/verification` left open across a terms update
  // cannot start an inquiry until the terms are accepted. The page refreshes on 403 and its own redirect takes over.
  if (await getOnboardingStep(user.id)) throw new ApiError({ message: 'Forbidden', status: 403, capture: false });

  const body = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) throw new ApiError({ message: 'Invalid request payload', status: 400, capture: false });
  const subjectId = body.data.subjectId ?? user.id;
  // Read fresh on every start: someone removed from an organization cannot start for it from an open tab.
  if (!(await organizations.canActForSubject({ userId: user.id, subjectId }))) return notMember();

  const ip = ipAddress(req) ?? '127.0.0.1';
  const [userLimitRes, ipLimitRes] = await Promise.all([
    handlePromise(userRatelimit.limit(user.id)),
    handlePromise(ipRatelimit.limit(ip))
  ]);

  if (userLimitRes.err || !userLimitRes.res || ipLimitRes.err || !ipLimitRes.res) {
    throw new ApiError({
      message: 'Error checking rate limit',
      status: 500,
      exception: userLimitRes.err ?? ipLimitRes.err
    });
  }

  if (!userLimitRes.res.success || !ipLimitRes.res.success) {
    const resetAt = Math.max(userLimitRes.res.reset, ipLimitRes.res.reset);
    throw new ApiError({
      message: 'The request has been rate limited.',
      status: 429,
      capture: false,
      headers: { 'Retry-After': String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))) }
    });
  }

  const lockRes = await handlePromise(takeStartLock(subjectId, START_LOCK_TTL_SECONDS));
  if (lockRes.err) throw new ApiError({ message: 'Error acquiring start lock', status: 500, exception: lockRes.err });
  const lock = lockRes.res;
  if (!lock) {
    // Another request for this subject is still inside the lock, or a release
    // failed and the key has its TTL left to expire. Neither is a fault, and
    // the page rests its buttons for a moment rather than offering a Retry.
    throw new ApiError({
      message: 'A verification is already being started. Try again in a moment.',
      status: 409,
      capture: false
    });
  }

  try {
    // Again, now the key is held: leaving takes it too, so whoever passes here stays a member until the record names them.
    if (!(await organizations.canActForSubject({ userId: user.id, subjectId }))) return notMember();

    const result = await verification.startVerification({ subjectId, actorUserId: user.id });

    if (result.ok) return NextResponse.json({ success: true, data: result.value });

    const { error } = result;

    if (error.code === 'persona_unavailable') {
      Sentry.captureException(new Error(`Persona unavailable: ${error.cause.message}`), {
        tags: { source: 'API', flow: FLOW, reason: error.cause.reason },
        extra: { subjectId, httpStatus: error.cause.httpStatus }
      });
      return NextResponse.json({ error: 'Verification is temporarily unavailable', code: error.code }, { status: 503 });
    }

    // The queue, not Persona: the re-read found a transition and could not announce it. Same answer to the page.
    if (error.code === 'queue_unavailable') {
      Sentry.captureException(
        new Error('KYC notifications could not be queued during a start', { cause: error.cause }),
        {
          tags: { source: 'API', flow: FLOW, reason: 'queue' },
          extra: { subjectId }
        }
      );
      return NextResponse.json({ error: 'Verification is temporarily unavailable', code: error.code }, { status: 503 });
    }
    const { code } = error;

    // Policy refusals are the user's own state, not a fault: no capture.
    return NextResponse.json({ error: 'Verification cannot be started', code }, { status: 409 });
  } finally {
    await handlePromise(lock.release());
  }
};

export const POST = withErrorHandler('Error starting verification', handler);
