import { redirect } from 'next/navigation';

import { OPPORTUNITIES, opportunityPath } from '@/opportunities';

/**
 * `/` stays the app's generic entry point — deposit-reminder emails,
 * post-onboarding and the landing site all point at it — and forwards to the
 * only Opportunity. The registry is a literal with exactly one entry, so the
 * index is safe.
 */
export default function HomePage() {
  redirect(opportunityPath(OPPORTUNITIES[0]!));
}
