import {
  type DailyTokenSnapshot,
  type InvestorPositionCheckpoint,
  compareCheckpoints,
  getUtcDayStartSeconds
} from '@zivoe/centrifuge-indexer';

import { DAY_MS } from '@/components/chart/axis';

import { toD18, truncateToCents } from './positions';

export const HISTORY_RANGES = ['7D', '30D', '90D', '1Y', 'All'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];
const RANGE_DAYS: Record<Exclude<HistoryRange, 'All'>, number> = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 };

/** USD value (18 decimals) of the wallet's share tokens at one instant. */
export type HistoryPoint = { timestampMs: number; valueD18: bigint };

export type BalanceHistory = {
  /** One point per closed UTC day from the wallet's first share-token movement, stamped at the day's end. */
  points: Array<HistoryPoint>;
  /** Today, from the live balances and share price; absent while either is unknown. */
  livePoint: HistoryPoint | undefined;
};

/**
 * The value of the share tokens in the wallet, day by day: the end-of-day
 * balance on every chain (from the indexer's checkpoints) at that day's
 * closing share price, plus a live point from the balances the page reads
 * right now. The indexer is the only source for the past and the chain the
 * only source for now; nothing reconciles the two, so an indexer that lags
 * a deposit by minutes shows it at the live point and catches up on its own.
 * Escrowed shares are deliberately not in here: this is what the wallet holds.
 */
export function buildBalanceHistory({
  checkpoints,
  chains,
  prices,
  liveBalances,
  livePrice,
  nowMs
}: {
  checkpoints: ReadonlyArray<InvestorPositionCheckpoint>;
  /** The share token on each chain the deployment serves. */
  chains: ReadonlyArray<{ chainId: number; decimals: number }>;
  prices: ReadonlyArray<DailyTokenSnapshot>;
  /** Share balance by chain id; the live point needs every chain. */
  liveBalances: ReadonlyMap<number, bigint | undefined>;
  livePrice: bigint | undefined;
  nowMs: number;
}): BalanceHistory {
  const decimalsOf = new Map(chains.map((chain) => [chain.chainId, chain.decimals]));
  const ordered = checkpoints
    .filter((checkpoint) => decimalsOf.has(checkpoint.chainId) && checkpoint.timestampMs <= nowMs)
    .sort(compareCheckpoints);

  const priceByDay = new Map(prices.map((snapshot) => [snapshot.dayStartSeconds * 1000, snapshot.tokenPrice]));
  const points: Array<HistoryPoint> = [];
  const first = ordered[0];
  if (first) {
    const balances = new Map<number, bigint>();
    const today = getUtcDayStartSeconds(nowMs) * 1000;
    let index = 0;
    let price: bigint | undefined;
    for (let day = getUtcDayStartSeconds(first.timestampMs) * 1000; day < today; day += DAY_MS) {
      for (; index < ordered.length && ordered[index]!.timestampMs < day + DAY_MS; index++)
        balances.set(ordered[index]!.chainId, ordered[index]!.balanceAfter);
      // A day without a close row keeps the last known price: closes are
      // published daily and a gap is a publication hiccup, not a price change.
      price = priceByDay.get(day) ?? price;
      if (price === undefined) continue;
      // Cut to the cent per chain, like the live point and the hero's cells.
      const closePrice = price;
      const valueD18 = [...balances].reduce(
        (acc, [chainId, balance]) =>
          acc + truncateToCents((toD18(balance, decimalsOf.get(chainId)!) * closePrice) / 10n ** 18n),
        0n
      );
      points.push({ timestampMs: day + DAY_MS - 1, valueD18 });
    }
  }

  const liveKnown = livePrice !== undefined && chains.every((chain) => liveBalances.get(chain.chainId) !== undefined);
  // Cut to the cent per chain, exactly like the hero's per-network cells, so the two figures agree as printed.
  const livePoint = liveKnown
    ? {
        timestampMs: nowMs,
        valueD18: chains.reduce(
          (acc, chain) =>
            acc + truncateToCents((toD18(liveBalances.get(chain.chainId)!, chain.decimals) * livePrice) / 10n ** 18n),
          0n
        )
      }
    : undefined;

  return { points, livePoint };
}

const rangeStart = (range: HistoryRange, nowMs: number) =>
  range === 'All' ? -Infinity : getUtcDayStartSeconds(nowMs) * 1000 - (RANGE_DAYS[range] - 1) * DAY_MS;

/** The points inside a range, oldest first, the live point last. */
export function selectRange({
  history,
  range,
  nowMs
}: {
  history: BalanceHistory;
  range: HistoryRange;
  nowMs: number;
}): Array<HistoryPoint> {
  const start = rangeStart(range, nowMs);
  const points = history.points.filter((point) => point.timestampMs >= start);
  return history.livePoint ? [...points, history.livePoint] : points;
}

/**
 * Which ranges the history can honestly fill: a range is offered only when
 * the wallet's history reaches back to its start, so "over the past year"
 * never labels two months of data. 'All' is always offered.
 */
export function availableRanges({ history, nowMs }: { history: BalanceHistory; nowMs: number }): Array<HistoryRange> {
  const firstTs = history.points[0]?.timestampMs;
  return HISTORY_RANGES.filter(
    (range) => range === 'All' || (firstTs !== undefined && firstTs <= rangeStart(range, nowMs) + DAY_MS - 1)
  );
}
