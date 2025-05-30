'use client';

import { ReactNode } from 'react';

import { useRouter } from 'next/navigation';

import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicContextProps, DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-aria-components';
import { toast } from 'sonner';
import { mainnet, sepolia } from 'viem/chains';
import { WagmiProvider, createConfig, http } from 'wagmi';

import { Toaster } from '@zivoe/ui/core/sonner';

import { env } from '@/env';

export default function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <>
      <RouterProvider navigate={router.push}>
        <DynamicContextProvider settings={DYNAMIC_SETTINGS}>
          <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
              <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
              <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
          </WagmiProvider>
        </DynamicContextProvider>
      </RouterProvider>

      <Toaster />
    </>
  );
}

const DYNAMIC_SETTINGS: DynamicContextProps['settings'] = {
  environmentId: env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
  walletConnectors: [EthereumWalletConnectors],
  initialAuthenticationMode: 'connect-only',
  networkValidationMode: 'always',
  appName: 'Zivoe'
};

// TODO: Add RPC providers
const config = createConfig({
  chains: env.NEXT_PUBLIC_NETWORK === 'MAINNET' ? [mainnet] : [sepolia],
  multiInjectedProviderDiscovery: false,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http()
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

      const message = query.meta?.toastErrorMessage ?? error.message ?? 'An Error Occurred';
      toast.error(message);
    }
  })
});
