import * as Sentry from '@sentry/nextjs';
import { QueryCache, QueryClient, type QueryKey, isServer } from '@tanstack/react-query';

import { CENTRIFUGE_CHAINS, type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { toast } from '@zivoe/ui/core/sonner';

/** The chain a chain-scoped key carries (balances, positions, capacity, access), for the Sentry tag. */
function chainOfQueryKey(queryKey: QueryKey): CentrifugeChain | undefined {
  return queryKey.find(
    (part): part is CentrifugeChain => typeof part === 'string' && (CENTRIFUGE_CHAINS as Array<string>).includes(part)
  );
}

function makeQueryClient() {
  // Silent reads whose failure has been captured; a success clears them, so
  // a later outage is reported again.
  const reportedFailures = new WeakSet<object>();

  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        retry: 1
      }
    },

    queryCache: new QueryCache({
      onSuccess: (_data, query) => {
        reportedFailures.delete(query);
      },
      onError: (error, query) => {
        // Silent reads (balances, positions) run once per vault of every chain
        // and retry on their own after a failure, so a chain outage would
        // report every vault again on every back-off tick: only the first
        // failure since the read last succeeded is captured. The chain tag
        // lets an outage be filtered and alerted per chain.
        const isSilent = Boolean(query.meta?.skipErrorToast);
        if (!isSilent || !reportedFailures.has(query)) {
          if (isSilent) reportedFailures.add(query);
          Sentry.captureException(error, {
            tags: { source: 'QUERY', chain: chainOfQueryKey(query.queryKey) ?? 'none' }
          });
        }

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
