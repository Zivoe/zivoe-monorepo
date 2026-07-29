import { type ReactNode, Suspense } from 'react';

import { getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import { customNumber } from '@/lib/utils';

// One share class exists, so its AUM is the whole book and every card's
// figure. Becomes a per-Offering read — and a sum — once the Centrifuge
// module is parameterized by share class.
async function AumValue() {
  const metrics = await getCurrentShareMetrics();
  const aum = metrics ? Number(metrics.navD18) / 1e18 : null;

  return aum !== null ? `$${customNumber(aum)}` : '—';
}

/**
 * Streams the AUM figure so the static Offerings shell never waits on the
 * indexer read — the posture OnboardingGuard and the landing hero already
 * take. getCurrentShareMetrics dedupes across every instance in a request.
 */
export default function StreamedAum({ fallback }: { fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <AumValue />
    </Suspense>
  );
}
