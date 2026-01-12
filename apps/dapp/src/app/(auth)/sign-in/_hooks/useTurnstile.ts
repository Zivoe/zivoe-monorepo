import { useRef } from 'react';

import type { TurnstileInstance } from '@marsidev/react-turnstile';

type TurnstilePromiseRef = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};

export const useTurnstile = () => {
  const turnstileRef = useRef<TurnstileInstance>(null);
  const turnstilePromiseRef = useRef<TurnstilePromiseRef>(null);

  async function executeTurnstile(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      turnstilePromiseRef.current = { resolve, reject };

      try {
        // Turnstile token is valid only once, so reset before executing again
        turnstileRef.current?.reset();
        turnstileRef.current?.execute();
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  return { turnstileRef, turnstilePromiseRef, executeTurnstile };
};
