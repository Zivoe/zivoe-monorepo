/**
 * Axis arithmetic shared by every time-series chart in the dApp (the Zivoe
 * Vault's Token Price / NAV chart, the portfolio's balance chart), so two
 * charts on neighbouring pages pick their gridlines and day labels the same way.
 */

// Kill float noise from step arithmetic (0.98 + 0.02 -> 1, not 1.0000000000000002).
const snap = (value: number) => Number(value.toFixed(10));

/**
 * A "nice axis" for a non-negative series: pick a 1/2/2.5/5 × 10^n step
 * targeting ~4 gridline intervals, then snap the domain to step multiples so
 * the first and last gridlines are the domain edges — spacing stays even and
 * the line keeps at least a quarter-step of air at both ends (the floor never
 * dips below zero).
 */
export function niceAxis({ min, max }: { min: number; max: number }): {
  domain: [number, number];
  step: number;
  ticks: Array<number>;
} {
  // The 1e-9 clamp sits far below display granularity but above snap's
  // toFixed(10) horizon, so a wei-dust range can't collapse the step to zero
  // and NaN the domain.
  const rawStep = Math.max((max - min) / 4 || Math.max(Math.abs(max), 1) / 4, 1e-9);
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

  return { domain: [floor, top], step, ticks };
}

/**
 * The padded value window a series is drawn in: 15% of the range as air on
 * each side so any move fills a readable share of the plot, with `minSpan`
 * keeping a near-flat series from magnifying noise, then snapped to nice
 * gridlines. The floor is clamped at zero for these non-negative series.
 */
export function valueAxis({
  values,
  minSpan
}: {
  values: Array<number>;
  minSpan: number;
}): ReturnType<typeof niceAxis> {
  // Nothing to plot: a unit domain with no gridlines, so recharts draws an empty plot.
  if (values.length === 0) return { domain: [0, 1], step: 1, ticks: [] };

  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, minSpan);
  const pad = span * 0.15 + (span - (high - low)) / 2;

  return niceAxis({ min: Math.max(0, low - pad), max: high + pad });
}

/** Decimals so adjacent ticks stay distinct; min 2 keeps the money shape. */
export const stepDecimals = (step: number) => {
  const fraction = step.toFixed(10).replace(/0+$/, '').split('.')[1] ?? '';
  return Math.max(2, fraction.length);
};

export const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDayLabel(timestampMs: number) {
  const date = new Date(timestampMs);
  const day = date.getUTCDate();
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/** The same form in the reader's own time zone, for a point that is a moment rather than a UTC day. */
export function formatLocalDayLabel(timestampMs: number) {
  const date = new Date(timestampMs);
  return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
}

// X-axis tick labels drop the year; the tooltip keeps the full form.
export const formatDayTick = (timestampMs: number) => formatDayLabel(timestampMs).replace(/\s\d{4}$/, '');

/**
 * Day ticks at an even stride anchored at the newest point, so label spacing
 * stays fixed instead of recharts dropping colliding labels ad hoc. At most
 * `maxLabels` labels (the newest always among them).
 */
export function dayTicks({
  firstTs,
  lastTs,
  maxLabels = 7
}: {
  firstTs: number | undefined;
  lastTs: number | undefined;
  maxLabels?: number;
}): Array<number> {
  const ticks: Array<number> = [];
  if (firstTs === undefined || lastTs === undefined) return ticks;

  const dayCount = Math.round((lastTs - firstTs) / DAY_MS) + 1;
  const stride = Math.max(1, Math.ceil(dayCount / maxLabels)) * DAY_MS;
  for (let ts = lastTs; ts >= firstTs; ts -= stride) ticks.unshift(ts);
  return ticks;
}
