// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SETTLE_WINDOW_MS, useSettleWindow } from './useSettleWindow';

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
