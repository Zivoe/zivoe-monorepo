import { type Key } from 'react-aria-components';

import { type ShareStatsPayload } from '@zivoe/centrifuge-indexer';

import { type CentrifugeDailySnapshot } from '@/server/data';

import { customNumber } from '@/lib/utils';

export const CHART_TYPES = ['Share Price', 'NAV', 'APY'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export function formatChartValue(type: ChartType, value: number) {
  if (type === 'APY') return `${customNumber(value)}%`;
  return `$${customNumber(value, type === 'Share Price' ? 3 : 2)}`;
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
 * midnight (the overlay's last value becomes the arriving close row). APY gets
 * no overlay — the indexer only computes trailing yield per snapshot row, so a
 * today point would just restamp the newest close on a new date.
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

  const data = snapshots
    // A same-day price event can leave a bucket for today; the live overlay
    // below supersedes it.
    .filter((item) => item.timestampMs < todayStartMs)
    .map((item) => {
      let data: number | null;
      if (type === 'Share Price') data = item.sharePrice;
      else if (type === 'NAV') data = item.nav;
      else data = item.apy;

      return { day: formatDayLabel(item.timestampMs), data };
    })
    .filter((item): item is { day: string; data: number } => item.data !== null);

  const currentValue =
    current && type !== 'APY'
      ? Number(type === 'Share Price' ? current.sharePriceD18 : current.navD18) / 1e18
      : undefined;

  if (currentValue !== undefined) data.push({ day: formatDayLabel(todayStartMs), data: currentValue });

  // The headline is the current metric, never an older point restamped as
  // current: a current-but-null APY renders the explicit unavailable state,
  // and only a missing payload falls back to the newest plotted close.
  let headline: string | undefined;
  if (type === 'APY' && current) headline = current.apy !== null ? formatChartValue(type, current.apy) : '—';
  else if (currentValue !== undefined) headline = formatChartValue(type, currentValue);
  else {
    const lastPoint = data[data.length - 1];
    if (lastPoint) headline = formatChartValue(type, lastPoint.data);
  }

  let domain: [number, number];
  let ticks: Array<number> | undefined;

  const values = data.map((d) => d.data);

  if (type === 'Share Price' && values.length > 0) {
    const maxValue = Math.max(...values);

    // Round up to the next cent; the 4-decimal pre-round keeps float noise
    // (1.07 * 100 === 107.00000000000001) from adding a phantom cent.
    let roundedMax = Math.ceil(Math.round(maxValue * 10000) / 100) / 100;

    // Guarantee visible headroom so the line never rides the top gridline.
    if (roundedMax - maxValue < 0.005) roundedMax = Math.round((roundedMax + 0.01) * 100) / 100;

    // Floor mirrors the ceiling: round down to the cent with visible footroom,
    // capped at the familiar 0.99 par baseline. A hardcoded 0.99 floor would
    // clip sub-par closes off-chart and invert the domain once every close
    // sits below it.
    const minValue = Math.min(...values);
    let roundedMin = Math.floor(Math.round(minValue * 10000) / 100) / 100;
    if (minValue - roundedMin < 0.005) roundedMin = Math.round((roundedMin - 0.01) * 100) / 100;
    const floor = Math.min(0.99, roundedMin);

    domain = [floor, roundedMax];

    // One-cent ticks in the usual near-par band; widen the step when a
    // drawdown stretches the axis so labels stay readable.
    const stepCents = Math.max(1, Math.ceil(Math.round((roundedMax - floor) * 100) / 12));
    ticks = [];
    for (let tick = floor; tick <= roundedMax; tick = Math.round((tick + stepCents / 100) * 100) / 100) {
      ticks.push(tick);
    }
  } else if (values.length > 0) {
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    domain = [Math.max(0, minValue * 0.95), maxValue * 1.05];
  } else {
    domain = [0, 1];
  }

  return {
    data,
    headline,
    type,
    domain,
    ticks
  };
};
