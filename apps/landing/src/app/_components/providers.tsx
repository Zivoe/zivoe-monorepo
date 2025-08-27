'use client';

import { ReactNode, useEffect } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import Intercom, { update } from '@intercom/messenger-js-sdk';
import { QueryClient, QueryClientProvider, isServer } from '@tanstack/react-query';
import { RouterProvider } from 'react-aria-components';

import { Toaster } from '@zivoe/ui/core/sonner';

import { env } from '@/env';

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
  const pathname = usePathname();
  const queryClient = getQueryClient();

  useEffect(() => {
    Intercom({ app_id: env.NEXT_PUBLIC_INTERCOM_APP_ID });
  }, []);

  useEffect(() => {
    update({});
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider>
        <RouterProvider navigate={router.push}>{children}</RouterProvider>
      </PostHogProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
