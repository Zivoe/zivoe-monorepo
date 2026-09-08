import { Ratelimit } from '@upstash/ratelimit';
import { ipAddress } from '@vercel/functions';

import { redis } from '@/server/clients/redis';

import { handlePromise } from '@/lib/utils';

// One sliding window per caller IP for each preview step: issuing slows a brute force of
// the secret, redeeming bounds what an unauthenticated path segment costs the database.
// Locally `ipAddress` is undefined (no `x-real-ip`), but only the preview routes call this.
const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'agent-sign-in'
});

/** `ok` to proceed, `limited` past the window, `error` when Redis could not answer — refuse, but not as a 429. */
export async function checkIpLimit(step: 'issue' | 'redeem', request: Request) {
  const { res, err } = await handlePromise(limiter.limit(`${step}:${ipAddress(request) ?? 'unknown'}`));
  // Upstash resolves timeouts with success: true, so refuse them explicitly.
  if (err || !res || res.reason === 'timeout') {
    console.error('agent-sign-in: rate limit check failed', err ?? res?.reason);
    return 'error';
  }

  return res.success ? 'ok' : 'limited';
}
