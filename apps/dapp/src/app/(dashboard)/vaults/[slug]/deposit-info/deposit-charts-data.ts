import { type Key } from 'react-aria-components';

import { type ShareStatsPayload } from '@zivoe/centrifuge-indexer';

import { type CentrifugeDailySnapshot } from '@/server/data/centrifuge-metrics';

import { formatNav, formatTokenPrice } from '@/lib/utils';

export const CHART_TYPES = ['Token Price', 'NAV'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

// Headline and tooltip values; the Y axis alone keeps its compact form (see
// the tick formatter in deposit-charts.tsx).
export function formatChartValue({ value, type }: { value: number; type: ChartType }) {
  return type === 'NAV' ? `$${formatNav(value)}` : `$${formatTokenPrice(value)}`;
}

// Kill float noise from step arithmetic (0.98 + 0.02 -> 1, not 1.0000000000000002).
const snap = (value: number) => Number(value.toFixed(10));

/**
 * Shared "nice axis" for both charts: pick a 1/2/2.5/5 × 10^n step targeting
 * ~5 gridline intervals, then snap the domain to step multiples so the first
 * and last gridlines are the domain edges — spacing stays even and the line
 * keeps at least a quarter-step of air at both ends (the floor never dips
 * below zero for these non-negative series).
 */
function niceAxis({ min, max }: { min: number; max: number }): { domain: [number, number]; ticks: Array<number> } {
  // The 1e-9 clamp sits far below display granularity but above snap's
  // toFixed(10) horizon, so a wei-dust range can't collapse the step to zero
  // and NaN the domain.
  const rawStep = Math.max((max - min) / 5 || Math.max(Math.abs(max), 1) / 5, 1e-9);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step =
    [1, 2, 2.5, 5].map((unit) => snap(unit * magnitude)).find((candidate) => candidate >= rawStep) ??
    snap(10 * magnitude);

  let floor = snap(Math.floor(snap(min / step)) * step);
  if (min - floor < step / 4) floor = snap(floor - step);
  if (min >= 0 && floor < 0) floor = 0;

  let top = snap(Math.ceil(snap(max / step)) * step);
  if (top - max < step / 4) top = snap(top + step);

  const intervals = Math.round((top - floor) / step);
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => snap(floor + index * step));

  return { domain: [floor, top], ticks };
}

function formatDayLabel(timestampMs: number) {
  const date = new Date(timestampMs);
  const day = date.getUTCDate();
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
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
      day: formatDayLabel(item.timestampMs),
      data: type === 'Token Price' ? item.sharePrice : item.nav
    }))
    .filter((item): item is { day: string; data: number } => item.data !== null);

  const currentValue = current
    ? Number(type === 'Token Price' ? current.sharePriceD18 : current.navD18) / 1e18
    : undefined;

  if (currentValue !== undefined) series.push({ day: formatDayLabel(todayStartMs), data: currentValue });

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

  let domain: [number, number];
  let ticks: Array<number> | undefined;

  const values = data.map((d) => d.data);

  if (values.length === 0) {
    domain = [0, 1];
  } else if (type === 'Token Price') {
    // The axis floor never sits above the familiar 0.99 par baseline, which
    // also gives a flat near-par series a non-degenerate range to step over.
    // A hardcoded 0.99 floor would clip sub-par closes off-chart.
    ({ domain, ticks } = niceAxis({ min: Math.min(0.99, ...values), max: Math.max(...values) }));
  } else {
    // Pad NAV by ±5% context before snapping so a flat series still reads as
    // a zoomed-out band instead of magnified day-to-day noise.
    ({ domain, ticks } = niceAxis({ min: Math.min(...values) * 0.95, max: Math.max(...values) * 1.05 }));
  }

  return {
    data,
    headline,
    type,
    domain,
    ticks
  };
};
