'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RESENDS = 3;
const COOLDOWN_DELAYS = [60, 120, 180] as const;

export function useOtpResendRateLimit() {
  const [resendCount, setResendCount] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(COOLDOWN_DELAYS[0]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Derived state
  const isOnCooldown = remainingSeconds > 0;
  const isExhausted = resendCount >= MAX_RESENDS;
  const canResend = !isOnCooldown && !isExhausted;
  const attemptsRemaining = MAX_RESENDS - resendCount;

  // Countdown timer effect
  const isCountingDown = remainingSeconds > 0;

  useEffect(() => {
    if (!isCountingDown) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isCountingDown]);

  // Called after successful resend
  const startCooldown = useCallback(() => {
    const newCount = resendCount + 1;
    setResendCount(newCount);

    if (newCount < MAX_RESENDS) {
      setRemainingSeconds(COOLDOWN_DELAYS[newCount] ?? 360);
    }
  }, [resendCount]);

  return {
    remainingSeconds,
    isOnCooldown,
    isExhausted,
    canResend,
    attemptsRemaining,
    startCooldown
  };
}
