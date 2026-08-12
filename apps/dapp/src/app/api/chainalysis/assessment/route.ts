import { type NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { ipAddress } from '@vercel/functions';
import { getAddress } from 'viem';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { type ChainalysisAssessment, getChainalysisAssessment } from '@/server/chainalysis/assessment';
import { redis } from '@/server/clients/redis';
import { sendTelegramMessage } from '@/server/utils/send-telegram';

import { addressSchema } from '@/lib/schemas';
import { ApiError, escapeHtml, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

const FLOW = 'chainalysis-assessment';
const DEFAULT_ERROR_MESSAGE = 'Error assessing account risk';

const querySchema = z.object({
  address: addressSchema
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(50, '10 m')
});

const handler = async (req: NextRequest): ApiResponse<ChainalysisAssessment> => {
  Sentry.setTag('source', 'API');
  Sentry.setTag('flow', FLOW);

  // Every legitimate caller is behind OnboardingGuard, so an anonymous request
  // is never the dapp — reject it before spending Redis or Chainalysis calls.
  const sessionRes = await handlePromise(auth.api.getSession({ headers: req.headers }));

  if (sessionRes.err) {
    throw new ApiError({ message: 'Error verifying session', status: 500, exception: sessionRes.err });
  }

  const user = sessionRes.res?.user;
  if (!user) throw new ApiError({ message: 'Unauthorized', status: 401, capture: false });

  const headers = new Headers();
  const ip = ipAddress(req) ?? '127.0.0.1';

  // Per-user limit is the primary guard; the IP limit backstops many accounts
  // sharing one machine.
  const [userLimitRes, ipLimitRes] = await Promise.all([
    handlePromise(ratelimit.limit(`chainalysis:user:${user.id}`)),
    handlePromise(ratelimit.limit(`chainalysis:ip:${ip}`))
  ]);

  if (userLimitRes.err || !userLimitRes.res || ipLimitRes.err || !ipLimitRes.res) {
    throw new ApiError({
      message: 'Error checking rate limit',
      status: 500,
      exception: userLimitRes.err ?? ipLimitRes.err
    });
  }

  const userLimit = userLimitRes.res;

  headers.set('X-RateLimit-Limit', userLimit.limit.toString());
  headers.set('X-RateLimit-Remaining', userLimit.remaining.toString());

  if (!userLimit.success || !ipLimitRes.res.success) {
    throw new ApiError({ message: 'The request has been rate limited.', status: 429, headers, capture: false });
  }

  const queryParams = {
    address: req.nextUrl.searchParams.get('address')
  };

  const parsedQuery = querySchema.safeParse(queryParams);
  if (!parsedQuery.success) {
    throw new ApiError({ message: 'Address is not valid', status: 400, capture: false });
  }

  const address = getAddress(parsedQuery.data.address);

  const assessmentRes = await handlePromise(getChainalysisAssessment({ address }));

  if (assessmentRes.err || !assessmentRes.res) {
    throw new ApiError({
      message: DEFAULT_ERROR_MESSAGE,
      status: 500,
      exception: assessmentRes.err
    });
  }

  const assessment = assessmentRes.res;

  if (assessment.risk === 'High' || assessment.risk === 'Severe') {
    const telegramMessage = [
      '<b>Chainalysis Assessment</b>',
      '',
      `${escapeHtml(assessment.risk)} - ${escapeHtml(assessment.riskReason ?? 'No risk reason returned')}`,
      '',
      `Address - ${escapeHtml(address)}`
    ].join('\n');

    const { err: telegramErr } = await handlePromise(
      sendTelegramMessage({
        chatId: env.TELEGRAM_CHAINALYSIS_CHAT_ID,
        text: telegramMessage
      })
    );

    if (telegramErr) {
      Sentry.captureException(telegramErr, {
        tags: { source: 'API', flow: FLOW },
        extra: {
          address,
          risk: assessment.risk
        }
      });
    }
  }

  return NextResponse.json({ success: true, data: assessment }, { headers });
};

export const GET = withErrorHandler(DEFAULT_ERROR_MESSAGE, handler);
