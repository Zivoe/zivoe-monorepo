import { describe, expect, it } from 'vitest';

import { type WalletCheckpoint } from '@zivoe/centrifuge-indexer';

import { buildWalletHistory, selectHistory } from './history';

const D18 = 10n ** 18n;
const day = (date: string) => Date.parse(`${date}T00:00:00Z`);
const checkpoint = (
  timestampMs: number,
  balanceBefore: bigint,
  balanceAfter: bigint,
  logIndex = 0
): WalletCheckpoint => ({
  chainId: 1,
  centrifugeId: '1',
  timestampMs,
  balanceBefore,
  balanceAfter,
  block: 10,
  logIndex,
  txHash: `0x${logIndex}`
});
const snapshots = ['2026-09-20', '2026-09-21', '2026-09-22'].map((date) => ({
  dayStartSeconds: day(date) / 1000,
  tokenPrice: 2n * D18,
  totalIssuance: null,
  yield30dComp365: null
}));
function inputs() {
  return {
    checkpoints: [
      checkpoint(day('2026-09-20') + 1000, 0n, 10n * D18),
      checkpoint(day('2026-09-21'), 10n * D18, 5n * D18, 1)
    ],
    snapshots,
    chains: [{ chainId: 1, decimals: 18, liveBalance: 5n * D18 }],
    checkpointsComplete: true,
    pricesComplete: true,
    livePrice: 3n * D18,
    nowMs: day('2026-09-23') + 1000
  };
}

describe('zSMB wallet history', () => {
  it('uses daily UTC closing balances, transfer checkpoints and a live endpoint', () => {
    const history = buildWalletHistory(inputs());
    expect(history.points.map((point) => point.valueD18)).toEqual([20n * D18, 10n * D18, 10n * D18, 15n * D18]);
    expect(history.complete).toBe(true);
    expect(selectHistory(history, '30D', inputs().nowMs)).toMatchObject({ changeD18: -5n * D18, percent: -25 });
  });
  it('sorts same-block checkpoints by log index and sums independent chains with declared decimals', () => {
    const data = inputs();
    const second = { ...checkpoint(day('2026-09-20') + 1000, 0n, 200_000_000n), chainId: 2 };
    data.checkpoints.push(second, checkpoint(day('2026-09-21'), 5n * D18, 7n * D18, 2));
    data.checkpoints.reverse();
    data.chains = [
      { chainId: 1, decimals: 18, liveBalance: 7n * D18 },
      { chainId: 2, decimals: 8, liveBalance: 200_000_000n }
    ];
    expect(buildWalletHistory(data).points.map((point) => point.valueD18)).toEqual([
      24n * D18,
      18n * D18,
      18n * D18,
      27n * D18
    ]);
  });
  it('does not fill missing prices or bridge a gap for returns', () => {
    const history = buildWalletHistory({ ...inputs(), snapshots: snapshots.slice(1) });
    expect(history.points[0]?.valueD18).toBeNull();
    expect(history.missingPrices).toBe(true);
    expect(selectHistory(history, 'All', inputs().nowMs).changeD18).toBeNull();
  });
  it('does not manufacture a starting value for an empty or single-point history', () => {
    const history = buildWalletHistory({ ...inputs(), checkpoints: [] });
    expect(history.points).toHaveLength(1);
    expect(history.complete).toBe(false);
    expect(selectHistory(history, 'All', inputs().nowMs)).toMatchObject({ changeD18: null, percent: null });
  });
  it('withholds percentages with zero starting value and incomplete checkpoint continuity', () => {
    const data = inputs();
    data.checkpoints = [checkpoint(day('2026-09-20'), 0n, 0n), checkpoint(day('2026-09-21'), 0n, 5n * D18)];
    expect(selectHistory(buildWalletHistory(data), '7D', data.nowMs)).toMatchObject({
      changeD18: 15n * D18,
      percent: null
    });
    data.checkpoints[1]!.balanceBefore = 1n;
    expect(buildWalletHistory(data).complete).toBe(false);
    expect(selectHistory(buildWalletHistory(data), '7D', data.nowMs).changeD18).toBeNull();
  });
  it('marks pagination limits and live/indexer disagreement incomplete', () => {
    expect(buildWalletHistory({ ...inputs(), checkpointsComplete: false }).complete).toBe(false);
    expect(buildWalletHistory({ ...inputs(), pricesComplete: false }).complete).toBe(false);
    expect(
      buildWalletHistory({ ...inputs(), chains: [{ chainId: 1, decimals: 18, liveBalance: 6n * D18 }] }).complete
    ).toBe(false);
  });
});
