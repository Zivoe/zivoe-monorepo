'use client';

import { ReactNode } from 'react';

import { useRouter } from 'next/navigation';

import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-aria-components';
import { sepolia } from 'viem/chains';
import { WagmiProvider, createConfig, http, useAccount } from 'wagmi';

import { env } from '@/env';

const config = createConfig({
  chains: [sepolia],
  multiInjectedProviderDiscovery: false,
  transports: {
    [sepolia.id]: http()
  }
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <RouterProvider navigate={router.push}>
      <DynamicContextProvider
        settings={{
          environmentId: env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
          walletConnectors: [EthereumWalletConnectors],
          initialAuthenticationMode: 'connect-only',
          networkValidationMode: 'always',
          appName: 'Zivoe'
        }}
      >
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
          </QueryClientProvider>
        </WagmiProvider>
      </DynamicContextProvider>
    </RouterProvider>
  );
}
