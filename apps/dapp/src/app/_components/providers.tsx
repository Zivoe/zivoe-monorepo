'use client';

import { ReactNode } from 'react';

import { useRouter } from 'next/navigation';

import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { RouterProvider } from 'react-aria-components';

import { env } from '@/env';

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
        {children}
      </DynamicContextProvider>
    </RouterProvider>
  );
}
