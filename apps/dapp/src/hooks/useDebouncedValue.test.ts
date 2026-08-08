// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './useDebouncedValue';

function renderDebounced(initialProps: { value: string; delayMs?: number }) {
  return renderHook((props: { value: string; delayMs?: number }) => useDebouncedValue(props), { initialProps });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('returns the value immediately on first render without debouncing', () => {
    const { result } = renderDebounced({ value: '100' });

    expect(result.current).toEqual({ debouncedValue: '100', isDebouncing: false });
  });

  it('surfaces a new value only after the default 300 ms delay', () => {
    const { result, rerender } = renderDebounced({ value: '' });

    rerender({ value: '250' });
    expect(result.current).toEqual({ debouncedValue: '', isDebouncing: true });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toEqual({ debouncedValue: '', isDebouncing: true });

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toEqual({ debouncedValue: '250', isDebouncing: false });
  });

  it('honors a custom delayMs', () => {
    const { result, rerender } = renderDebounced({ value: '', delayMs: 500 });

    rerender({ value: '1', delayMs: 500 });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toEqual({ debouncedValue: '', isDebouncing: true });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toEqual({ debouncedValue: '1', isDebouncing: false });
  });

  it('never surfaces intermediate values when changes arrive within the delay', () => {
    const { result, rerender } = renderDebounced({ value: 'a' });

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'c' });
    // b's timer would have fired by now had the c update not replaced it.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toEqual({ debouncedValue: 'a', isDebouncing: true });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toEqual({ debouncedValue: 'c', isDebouncing: false });
  });

  it('cancels the pending update on unmount', () => {
    const { result, rerender, unmount } = renderDebounced({ value: 'a' });

    rerender({ value: 'b' });
    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current).toEqual({ debouncedValue: 'a', isDebouncing: true });
  });
});
