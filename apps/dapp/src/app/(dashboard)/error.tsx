'use client';

import { startTransition, useEffect } from 'react';

import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';

import { Button } from '@zivoe/ui/core/button';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error, { tags: { source: 'DASHBOARD' } });
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h2 className="text-h4 text-primary">Something went wrong</h2>
      <Button
        onPress={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        Try again
      </Button>
    </div>
  );
}
