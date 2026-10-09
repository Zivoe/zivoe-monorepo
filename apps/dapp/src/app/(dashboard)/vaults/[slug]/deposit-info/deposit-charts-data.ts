import { type Key } from 'react-aria-components';

import { type ShareStatsPayload } from '@zivoe/centrifuge-indexer';

import { type CentrifugeDailySnapshot } from '@/server/data/centrifuge-metrics';

import { formatNav, formatTokenPrice } from '@/lib/utils';

import { dayTicks, formatDayLabel, stepDecimals, valueAxis } from '@/components/chart/axis';

export const CHART_TYPES = ['Token Price', 'NAV'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

// Headline and tooltip values; the Y axis alone keeps its compact form (see
// the tick formatter in deposit-charts.tsx).
export function formatChartValue({ value, type }: { value: number; type: ChartType }) {
  return type === 'NAV' ? `$${formatNav(value)}` : `$${formatTokenPrice(value)}`;
}

/**
 * Chart series and headline for one metric: the daily close series plus a live
 * "today" point from the current payload, which hands off seamlessly at UTC
 * midnight (the overlay's last value becomes the arriving close row).
 */
export const parseChartData = ({
  snapshots,
  current,
  typeIndex,
  todayStartMs
}: {
  snapshots: Array<CentrifugeDailySnapshot>;
  current: ShareStatsPayload | null;
  typeIndex: Key;
  todayStartMs: number;
}) => {
  const type = CHART_TYPES[Number(typeIndex)];
  if (!type) return undefined;

  const series = snapshots
    // A same-day price event can leave a bucket for today; the live overlay
    // below supersedes it.
    .filter((item) => item.timestampMs < todayStartMs)
    .map((item) => ({
      ts: item.timestampMs,
      day: formatDayLabel(item.timestampMs),
      data: type === 'Token Price' ? item.sharePrice : item.nav
    }))
    .filter((item): item is { ts: number; day: string; data: number } => item.data !== null);

  const currentValue = current
    ? Number(type === 'Token Price' ? current.sharePriceD18 : current.navD18) / 1e18
    : undefined;

  if (currentValue !== undefined)
    series.push({ ts: todayStartMs, day: formatDayLabel(todayStartMs), data: currentValue });

  // Drop the zero-valued days a share class records before it is funded
  const firstFundedIndex = series.findIndex((point) => point.data !== 0);
  const data = firstFundedIndex === -1 ? [] : series.slice(firstFundedIndex);

  // The headline is the current metric, never an older point restamped as
  // current — only a missing payload falls back to the newest plotted close.
  let headline: string | undefined;
  if (currentValue !== undefined) headline = formatChartValue({ value: currentValue, type });
  else {
    const lastPoint = data[data.length - 1];
    if (lastPoint) headline = formatChartValue({ value: lastPoint.data, type });
  }

  const xTicks = dayTicks({ firstTs: data[0]?.ts, lastTs: data[data.length - 1]?.ts });

  const values = data.map((d) => d.data);
  const high = Math.max(...values);
  // The min-span floor keeps a near-flat series from magnifying noise.
  const { domain, step, ticks } = valueAxis({
    values,
    minSpan: type === 'Token Price' ? 0.0004 : Math.max(high * 0.01, 1)
  });

  return {
    data,
    headline,
    type,
    domain,
    ticks: values.length === 0 ? undefined : ticks,
    xTicks,
    tickDecimals: stepDecimals(step)
  };
};
