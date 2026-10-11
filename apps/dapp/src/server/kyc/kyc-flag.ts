import 'server-only';

import * as Sentry from '@sentry/nextjs';

import { posthog } from '@/server/clients/posthog';

import { env } from '@/env';

/** The PostHog flag that reveals the KYC surfaces; its release condition lists the users by email. */
export const KYC_FLAG = 'kyc';

/**
 * How long the first check on a fresh server instance may wait for the first
 * download of the flag definitions. A download with a cold connection can take
 * longer than 300 ms, which read the flag off for invited users on a new
 * instance, so the wait covers it with room. Waited once: later checks read
 * readiness without waiting, so an unreachable PostHog (or a bad key) costs one
 * request this much, never every request.
 */
const DEFINITIONS_WAIT_MS = 1500;
let firstLoad: Promise<boolean> | undefined;

/** Waits for the definitions once per instance, and reports an instance that never got them. */
function definitionsLoaded() {
  return (firstLoad ??= posthog.waitForLocalEvaluationReady(DEFINITIONS_WAIT_MS).then((ready) => {
    if (!ready)
      Sentry.captureMessage('PostHog flag definitions did not load; the kyc flag reads as off', {
        level: 'warning',
        tags: { source: 'SERVER', flow: 'kyc-flag' }
      });
    return ready;
  }));
}

/**
 * Whether a user sees the KYC surfaces (`/verification`, its menu link, the
 * whitelist UX that points there). Off is exactly the app without KYC, so any
 * doubt — PostHog not ready, an error, a missing key — reads as off.
 *
 * Evaluated locally against definitions polled in the background: no network
 * call per check. Outside production it is always on: previews carry no
 * POSTHOG_FEATURE_FLAGS_KEY, read no flag, and need the feature.
 *
 * Remove with the flag at launch, along with its call sites.
 */
export async function isKycEnabled({ user }: { user: { id: string; email: string } }): Promise<boolean> {
  if (env.NEXT_PUBLIC_ENV !== 'production') return true;

  try {
    await definitionsLoaded();
    if (!posthog.isLocalEvaluationReady()) return false;

    const flags = await posthog.evaluateFlags(user.id, {
      flagKeys: [KYC_FLAG],
      // Local evaluation has no PostHog person data; the release condition matches on this.
      personProperties: { email: user.email },
      onlyEvaluateLocally: true
    });

    return flags.isEnabled(KYC_FLAG);
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'kyc-flag' } });
    return false;
  }
}
