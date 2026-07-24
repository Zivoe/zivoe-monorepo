import 'server-only';

import { getCentrifugeDailySnapshots, getCurrentShareMetrics } from './centrifuge-metrics';

// Consumed by the legacy daily-snapshot producer until its final teardown.
export const PROTOCOL_DAILY_SNAPSHOT_TAG = 'protocol-daily-snapshot';

export type { CentrifugeDailySnapshot } from './centrifuge-metrics';

export const data = {
  getCentrifugeDailySnapshots,
  getCurrentShareMetrics
};
