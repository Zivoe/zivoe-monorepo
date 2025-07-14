'use client';

import { ReactNode } from 'react';

import { useRouter } from 'next/navigation';

import { QueryClient, QueryClientProvider, isServer } from '@tanstack/react-query';
import { RouterProvider } from 'react-aria-components';

import { Toaster } from '@zivoe/ui/core/sonner';

import { PostHogProvider } from './posthog';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 3 * 60 * 1000,
        refetchOnWindowFocus: false
      }
    }
  });
}

let browserQueryClient: QueryClient | undefined = undefined;
function getQueryClient() {
  if (isServer) return makeQueryClient();
  else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export default function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider>
        <RouterProvider navigate={router.push}>{children}</RouterProvider>
      </PostHogProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
