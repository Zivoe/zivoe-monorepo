// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SETTLE_WINDOW_MS, readState, useSettleWindow } from './useSettleWindow';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const renderWindow = (isPending: boolean) =>
  renderHook((props: { isPending: boolean }) => useSettleWindow(props), { initialProps: { isPending } });

describe('useSettleWindow', () => {
  it('holds while reads are pending, until the window runs out', () => {
    const { result, rerender } = renderWindow(true);
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(SETTLE_WINDOW_MS - 1);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);

    // The straggler lands: nothing pending, nothing held.
    rerender({ isPending: false });
    expect(result.current).toBe(false);
  });

  it('never holds once everything has answered, and holds afresh for a new set of reads', () => {
    const { result, rerender } = renderWindow(true);
    rerender({ isPending: false });
    expect(result.current).toBe(false);

    rerender({ isPending: true });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(SETTLE_WINDOW_MS);
    });
    expect(result.current).toBe(false);

    // Another wallet: the earlier expiry does not carry over.
    rerender({ isPending: false });
    rerender({ isPending: true });
    expect(result.current).toBe(true);
  });
});

describe('readState', () => {
  const read = (result: { data?: number; isError?: boolean; errorUpdateCount?: number }) =>
    readState({ data: result.data, isError: result.isError ?? false, errorUpdateCount: result.errorUpdateCount ?? 0 });

  it('counts only a read with no answer of any kind as pending', () => {
    expect(read({})).toEqual({ data: undefined, isError: false, isPending: true });
    expect(read({ data: 1 })).toEqual({ data: 1, isError: false, isPending: false });
    expect(read({ isError: true, errorUpdateCount: 1 })).toEqual({ data: undefined, isError: true, isPending: false });
  });

  // TanStack reports a data-less query as pending again, not errored, for the
  // length of each retry; the window must not take that for a first read.
  it('keeps a failed read with nothing cached a failure while it retries', () => {
    expect(read({ errorUpdateCount: 1 })).toEqual({ data: undefined, isError: true, isPending: false });
  });

  it('keeps an earlier answer in use when a later read fails', () => {
    expect(read({ data: 1, isError: true, errorUpdateCount: 1 })).toEqual({ data: 1, isError: true, isPending: false });
  });
});
