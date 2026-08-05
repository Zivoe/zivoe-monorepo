import { useEffect, useState } from 'react';

/**
 * Debounce Module: owns timer replacement, superseded-update cancellation, and
 * unmount cleanup. Intermediate values never surface as `debouncedValue`.
 */
export function useDebouncedValue<T>({ value, delayMs = 300 }: { value: T; delayMs?: number }): {
  debouncedValue: T;
  isDebouncing: boolean;
} {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return { debouncedValue, isDebouncing: !Object.is(value, debouncedValue) };
}
