import {
  type DailyTokenSnapshot,
  type WalletCheckpoint,
  compareCheckpoints,
  getUtcDayStartSeconds
} from '@zivoe/centrifuge-indexer';

import { toD18 } from './model';

export const HISTORY_RANGES = ['7D', '30D', '90D', '1Y', 'All'] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];
export type HistoryPoint = { timestampMs: number; valueD18: bigint | null; live: boolean };
export type WalletHistory = { points: Array<HistoryPoint>; complete: boolean; missingPrices: boolean };
const DAY = 86_400_000;

/** End-of-UTC-day wallet balances, independent of escrow and stablecoin holdings. */
export function buildWalletHistory({
  checkpoints,
  snapshots,
  chains,
  checkpointsComplete,
  pricesComplete,
  livePrice,
  nowMs
}: {
  checkpoints: Array<WalletCheckpoint>;
  snapshots: Array<DailyTokenSnapshot>;
  chains: Array<{ chainId: number; decimals: number; liveBalance: bigint | undefined }>;
  checkpointsComplete: boolean;
  pricesComplete: boolean;
  livePrice: bigint | undefined;
  nowMs: number;
}): WalletHistory {
  const chainIds = new Set(chains.map((chain) => chain.chainId));
  const ordered = [...checkpoints]
    .filter((point) => point.chainId !== null && chainIds.has(point.chainId) && point.timestampMs <= nowMs)
    .sort(compareCheckpoints);
  const first = ordered[0];
  const points: Array<HistoryPoint> = [];
  let complete = checkpointsComplete && pricesComplete && checkpoints.every((point) => point.chainId !== null);
  const states = chains.map((chain) => {
    const entries = ordered.filter((point) => point.chainId === chain.chainId);
    let previous: bigint | undefined;
    for (const entry of entries) {
      if (previous !== undefined && previous !== entry.balanceBefore) complete = false;
      previous = entry.balanceAfter;
    }
    if (chain.liveBalance === undefined || (previous ?? 0n) !== chain.liveBalance) complete = false;
    return {
      ...chain,
      entries,
      index: 0,
      balance:
        checkpointsComplete && (entries[0]?.balanceBefore ?? chain.liveBalance) === 0n
          ? 0n
          : (undefined as bigint | undefined)
    };
  });
  const prices = new Map(snapshots.map((snapshot) => [snapshot.dayStartSeconds * 1000, snapshot.tokenPrice]));
  const today = getUtcDayStartSeconds(nowMs) * 1000;
  let missingPrices = false;
  if (first) {
    for (let day = getUtcDayStartSeconds(first.timestampMs) * 1000; day < today; day += DAY) {
      for (const state of states) {
        while (state.entries[state.index] && state.entries[state.index]!.timestampMs < day + DAY) {
          state.balance = state.entries[state.index]!.balanceAfter;
          state.index++;
        }
      }
      const price = prices.get(day);
      if (price === undefined || price <= 0n) missingPrices = true;
      const known = states.every((state) => state.balance !== undefined);
      const balanceD18 = states.reduce((sum, state) => sum + toD18(state.balance ?? 0n, state.decimals), 0n);
      points.push({
        timestampMs: day + DAY - 1,
        valueD18: known && price !== undefined && price > 0n ? (balanceD18 * price) / 10n ** 18n : null,
        live: false
      });
    }
  }
  const liveKnown = livePrice !== undefined && chains.every((chain) => chain.liveBalance !== undefined);
  points.push({
    timestampMs: nowMs,
    valueD18: liveKnown
      ? (chains.reduce((sum, chain) => sum + toD18(chain.liveBalance!, chain.decimals), 0n) * livePrice) / 10n ** 18n
      : null,
    live: true
  });
  return { points, complete: complete && !missingPrices && liveKnown, missingPrices };
}

export function selectHistory(history: WalletHistory, range: HistoryRange, nowMs: number) {
  const days = range === 'All' ? null : { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }[range];
  const start = days === null ? -Infinity : getUtcDayStartSeconds(nowMs) * 1000 - (days - 1) * DAY;
  const points = history.points.filter((point) => point.timestampMs >= start);
  const first = points[0];
  const last = points.at(-1);
  const canCompare =
    history.complete &&
    points.length > 1 &&
    points.every((point) => point.valueD18 !== null) &&
    first?.valueD18 !== null &&
    last?.valueD18 !== null;
  const changeD18 = canCompare && first && last ? last.valueD18! - first.valueD18! : null;
  const percent =
    changeD18 !== null && first?.valueD18 && first.valueD18 > 0n
      ? Number((changeD18 * 10000n) / first.valueD18) / 100
      : null;
  return { points, changeD18, percent };
}
