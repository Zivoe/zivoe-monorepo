import { z } from 'zod';

export const HOME_METRICS_REFRESH_MS = 60_000;
export const STATISTIC_DISCLOSURE =
  'Historical platform metrics, rounded for presentation purposes. Past performance is not indicative of future results. For informational purposes only; this is not an offer to sell or a solicitation of an offer to buy any security or financial product.';

const readingSchema = z.object({
  value: z.string().regex(/^\d+$/),
  sourceAt: z.string().datetime(),
  observedAt: z.string().datetime(),
  indexedAt: z.string().datetime().optional()
});
export const metricSchema = z.union([
  readingSchema.extend({ status: z.enum(['available', 'stale']) }),
  z.object({ status: z.literal('unavailable'), value: z.null(), sourceAt: z.null(), observedAt: z.null() })
]);
export const homeMetricsSchema = z.object({
  /** NAV is USD D36; Token Price is USD D18. */
  nav: metricSchema,
  tokenPrice: metricSchema
});
export type MetricReading = z.infer<typeof readingSchema>;
export type HomeMetric = z.infer<typeof metricSchema>;
export type HomeMetrics = z.infer<typeof homeMetricsSchema>;
export const unavailableMetric: HomeMetric = { status: 'unavailable', value: null, sourceAt: null, observedAt: null };

function fixed(value: bigint, decimals: number, places: number) {
  const divisor = 10n ** BigInt(decimals - places);
  const rounded = (value + divisor / 2n) / divisor;
  const scale = 10n ** BigInt(places);
  return `${(rounded / scale).toLocaleString('en-US')}.${(rounded % scale).toString().padStart(places, '0')}`;
}

export function formatTokenPrice(value: string) {
  return `$${fixed(BigInt(value), 18, 4)}`;
}

export function formatNav(value: string) {
  const raw = BigInt(value);
  const units = [
    { power: 12, suffix: 'T' },
    { power: 9, suffix: 'B' },
    { power: 6, suffix: 'M' },
    { power: 3, suffix: 'K' }
  ];
  // Select the unit after half-up rounding, including boundaries such as $999.995K → $1.00M.
  const unit = units.find(({ power }) => raw >= 10n ** BigInt(36 + power) - 5n * 10n ** BigInt(36 + power - 6));
  return `$${fixed(raw, 36 + (unit?.power ?? 0), 2)}${unit?.suffix ?? ''}`;
}

export function metricTime(timestamp: string) {
  return (
    new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(
      new Date(timestamp)
    ) + ' UTC'
  );
}

/** Preserve a browser's last good reading across API errors or a cold server instance. */
export function mergeMetric(previous: HomeMetric, next: HomeMetric): HomeMetric {
  if (next.status === 'unavailable' && previous.status !== 'unavailable') return { ...previous, status: 'stale' };
  return next;
}
