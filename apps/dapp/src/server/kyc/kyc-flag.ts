import 'server-only';

import * as Sentry from '@sentry/nextjs';

import { posthog } from '@/server/clients/posthog';

import { env } from '@/env';

/** The PostHog flag that reveals the KYC surfaces; its release condition lists the users by email. */
export const KYC_FLAG = 'kyc';

/**
 * How long the first check on an instance may wait for the first download of
 * the flag definitions. Waited once: later checks read readiness without
 * waiting, so an unreachable PostHog (or a bad key) costs one request this
 * much, never every request.
 */
const DEFINITIONS_WAIT_MS = 300;
let firstLoad: Promise<boolean> | undefined;

/**
 * Whether a user sees the KYC surfaces (`/verification`, its menu link, the
 * whitelist UX that points there). Off is exactly the app without KYC, so any
 * doubt — PostHog not ready, an error, a missing key — reads as off.
 *
 * Evaluated locally against definitions polled in the background: no network
 * call per check. Outside production it is always on, since PostHog runs on a
 * fake key there and previews need the feature.
 *
 * Remove with the flag at launch, along with its call sites.
 */
export async function isKycEnabled({ user }: { user: { id: string; email: string } }): Promise<boolean> {
  if (env.NEXT_PUBLIC_ENV !== 'production') return true;

  try {
    await (firstLoad ??= posthog.waitForLocalEvaluationReady(DEFINITIONS_WAIT_MS));
    if (!posthog.isLocalEvaluationReady()) return false;

    const enabled = await posthog.isFeatureEnabled(KYC_FLAG, user.id, {
      // Local evaluation has no PostHog person data; the release condition matches on this.
      personProperties: { email: user.email },
      onlyEvaluateLocally: true,
      sendFeatureFlagEvents: false
    });

    return enabled === true;
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'kyc-flag' } });
    return false;
  }
}
