import { useRef } from 'react';

import type { TurnstileInstance, TurnstileProps } from '@marsidev/react-turnstile';

import { toast } from '@zivoe/ui/core/sonner';

type TurnstilePromiseRef = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};

/**
 * Drives a Turnstile widget rendered with `execution: 'execute'`: `executeTurnstile()` runs one challenge
 * and resolves with a single-use token. Spread `turnstileHandlers` onto the widget and attach `turnstileRef`
 * to it and `turnstileSlotRef` to its wrapper (scrolled into view when Cloudflare needs an interaction).
 *
 * Every terminal widget outcome settles the promise, so callers never hang in a pending state.
 */
export const useTurnstile = () => {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const turnstileSlotRef = useRef<HTMLDivElement>(null);
  const turnstilePromiseRef = useRef<TurnstilePromiseRef>(null);
  const isWidgetReadyRef = useRef(false);

  async function executeTurnstile(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      // The script may still be loading (or blocked); calling execute() then is a silent no-op that would never settle
      if (!turnstileRef.current || !isWidgetReadyRef.current) {
        reject(new Error('Turnstile widget is not ready'));
        return;
      }

      turnstilePromiseRef.current = { resolve, reject };

      try {
        // Turnstile token is valid only once, so reset before executing again
        turnstileRef.current.reset();
        turnstileRef.current.execute();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  const turnstileHandlers = {
    onWidgetLoad: () => {
      isWidgetReadyRef.current = true;
    },
    onSuccess: (token) => turnstilePromiseRef.current?.resolve(token),
    onError: (error) => turnstilePromiseRef.current?.reject(new Error(`Turnstile error ${error}`)),
    onTimeout: () => turnstilePromiseRef.current?.reject(new Error('Turnstile challenge timed out')),
    onUnsupported: () => turnstilePromiseRef.current?.reject(new Error('Turnstile does not support this browser')),
    onBeforeInteractive: () => {
      toast({ type: 'warning', title: 'Verify You Are Human to Continue' });
      turnstileSlotRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  } satisfies Partial<TurnstileProps>;

  return { turnstileRef, turnstileSlotRef, turnstileHandlers, executeTurnstile };
};
