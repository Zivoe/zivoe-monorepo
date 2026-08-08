import * as Sentry from '@sentry/nextjs';
import { QueryCache, QueryClient, isServer } from '@tanstack/react-query';

import { toast } from '@zivoe/ui/core/sonner';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        retry: 1
      }
    },

    queryCache: new QueryCache({
      onError: (error, query) => {
        Sentry.captureException(error, { tags: { source: 'QUERY' } });

        if (query.meta?.skipErrorToast) return;

        // A server-side prefetch failure has no toast surface (and `toast` is
        // a client reference here); the browser refetches on mount and reports
        // its own errors.
        if (isServer) return;

        const title = query.meta?.toastErrorMessage ?? error.message ?? 'An Error Occurred';
        toast({ type: 'error', title });
      }
    })
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Per-request client on the server — a module-scoped client would be shared
 * across concurrent requests, so hydrated state could bleed between users —
 * and one persistent client in the browser, so suspense re-renders don't
 * recreate the cache.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  return (browserQueryClient ??= makeQueryClient());
}
