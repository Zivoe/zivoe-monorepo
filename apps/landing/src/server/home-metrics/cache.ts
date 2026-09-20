import { HOME_METRICS_REFRESH_MS, type HomeMetric, type MetricReading, unavailableMetric } from '@/lib/home-metrics';

/** Per-instance bounded cache, including failed attempts, with concurrent reads coalesced. */
export function createMetricSource<K extends string>(
  keys: ReadonlyArray<K>,
  read: () => Promise<Record<K, MetricReading>>,
  now = Date.now
) {
  let nextReadAt = 0;
  let pending: Promise<Record<K, HomeMetric>> | undefined;
  let latest = Object.fromEntries(keys.map((key) => [key, unavailableMetric])) as Record<K, HomeMetric>;
  return async (): Promise<Record<K, HomeMetric>> => {
    if (pending) return pending;
    if (now() < nextReadAt) return latest;
    nextReadAt = now() + HOME_METRICS_REFRESH_MS;
    pending = read()
      .then((readings) => {
        latest = Object.fromEntries(keys.map((key) => [key, { ...readings[key], status: 'available' }])) as Record<
          K,
          HomeMetric
        >;
        return latest;
      })
      .catch(() => {
        latest = Object.fromEntries(
          keys.map((key) => [
            key,
            latest[key].status === 'unavailable' ? unavailableMetric : { ...latest[key], status: 'stale' }
          ])
        ) as Record<K, HomeMetric>;
        return latest;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
