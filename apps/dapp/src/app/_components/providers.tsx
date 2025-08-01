'use client';

import { ReactNode, useEffect } from 'react';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicContextProps, DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import * as Sentry from '@sentry/nextjs';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-aria-components';
import { mainnet, sepolia } from 'viem/chains';
import { State, WagmiProvider, cookieStorage, createConfig, createStorage, fallback, http } from 'wagmi';

import { Toaster, toast } from '@zivoe/ui/core/sonner';

import { NETWORK } from '@/lib/constants';

import { useAccount } from '@/hooks/useAccount';

import { env } from '@/env';

import { PostHogProvider } from './posthog';

const WelcomeDialog = dynamic(() => import('./welcome-dialog'), {
  ssr: false
});

const DYNAMIC_SETTINGS: DynamicContextProps['settings'] = {
  environmentId: env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
  walletConnectors: [EthereumWalletConnectors],
  initialAuthenticationMode: 'connect-only',
  networkValidationMode: 'always',
  appName: 'Zivoe',
  mobileExperience: 'in-app-browser'
};

export const wagmiConfig = createConfig({
  chains: NETWORK === 'MAINNET' ? [mainnet] : [sepolia],
  multiInjectedProviderDiscovery: false,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  }),
  transports: {
    [mainnet.id]: fallback([
      http(env.NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY),
      http(env.NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY)
    ]),
    [sepolia.id]: fallback([
      http(env.NEXT_PUBLIC_SEPOLIA_RPC_URL_PRIMARY),
      http(env.NEXT_PUBLIC_SEPOLIA_RPC_URL_SECONDARY)
    ])
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1
    }
  },

  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.skipErrorToast) return;

      const title = query.meta?.toastErrorMessage ?? error.message ?? 'An Error Occurred';
      toast({ type: 'error', title });

      Sentry.captureException(error, { tags: { source: 'QUERY' } });
    }
  })
});

export default function Providers({
  children,
  initialState
}: {
  children: ReactNode;
  initialState: State | undefined;
}) {
  const router = useRouter();

  return (
    <>
      <RouterProvider navigate={router.push}>
        <PostHogProvider>
          <DynamicContextProvider settings={DYNAMIC_SETTINGS}>
            <WagmiProvider config={wagmiConfig} initialState={initialState}>
              <QueryClientProvider client={queryClient}>
                <DynamicWagmiConnector>
                  <SentryContext>{children}</SentryContext>
                </DynamicWagmiConnector>
                <ReactQueryDevtools initialIsOpen={false} />
              </QueryClientProvider>
            </WagmiProvider>
          </DynamicContextProvider>
        </PostHogProvider>
      </RouterProvider>

      <Toaster />
      <WelcomeDialog />
    </>
  );
}

function SentryContext({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { primaryWallet } = useDynamicContext();

  useEffect(() => {
    Sentry.setUser(address ? { id: address } : null);

    const wallet = address && primaryWallet?.key ? primaryWallet.key : null;
    Sentry.setTag('wallet', wallet);
  }, [address, primaryWallet]);

  return <>{children}</>;
}
