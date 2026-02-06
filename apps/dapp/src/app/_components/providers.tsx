'use client';

import { ReactNode, useEffect } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicContextProps, DynamicContextProvider, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import Intercom, { update } from '@intercom/messenger-js-sdk';
import * as Sentry from '@sentry/nextjs';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-aria-components';
import { mainnet } from 'viem/chains';
import { State, WagmiProvider, cookieStorage, createConfig, createStorage, fallback, http } from 'wagmi';

import { Toaster, toast } from '@zivoe/ui/core/sonner';

import { trackWalletConnection } from '@/server/actions/track-wallet-connection';

import { authClient, useSession } from '@/lib/auth-client';
import { handlePromise } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import { env } from '@/env';

import { PostHogProvider } from './posthog';

const DYNAMIC_SETTINGS: DynamicContextProps['settings'] = {
  environmentId: env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
  walletConnectors: [EthereumWalletConnectors],
  initialAuthenticationMode: 'connect-only',
  networkValidationMode: 'always',
  appName: 'Zivoe',
  mobileExperience: 'redirect'
};

export const wagmiConfig = createConfig({
  chains: [mainnet],
  multiInjectedProviderDiscovery: false,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  }),
  transports: {
    [mainnet.id]: fallback([
      http(env.NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY),
      http(env.NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY)
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
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    Intercom({ app_id: env.NEXT_PUBLIC_INTERCOM_APP_ID });
  }, []);

  useEffect(() => {
    update({});
  }, [pathname]);

  // Refresh the signed cache cookie as RSC are not able to do it
  // https://www.better-auth.com/docs/integrations/next#rsc-and-server-actions
  useEffect(() => {
    authClient.getSession();
  }, [pathname]);

  return (
    <>
      <RouterProvider navigate={router.push}>
        <PostHogProvider>
          <DynamicContextProvider settings={DYNAMIC_SETTINGS}>
            <WagmiProvider config={wagmiConfig} initialState={initialState}>
              <QueryClientProvider client={queryClient}>
                <DynamicWagmiConnector>
                  <WalletTracker />
                  <SentryContext>{children}</SentryContext>
                </DynamicWagmiConnector>
                <ReactQueryDevtools initialIsOpen={false} />
              </QueryClientProvider>
            </WagmiProvider>
          </DynamicContextProvider>
        </PostHogProvider>
      </RouterProvider>

      <Toaster />
    </>
  );
}

function SentryContext({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { primaryWallet } = useDynamicContext();
  const { data: session } = useSession();

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    const email = session?.user?.email ?? null;

    Sentry.setUser(userId || email || address ? { id: userId ?? undefined, email: email ?? undefined, address } : null);

    const wallet = address && primaryWallet?.key ? primaryWallet.key : null;
    Sentry.setTag('wallet', wallet);
  }, [address, primaryWallet, session]);

  return <>{children}</>;
}

// * Wallet connection tracking relies on connect-only mode where only one wallet
// * is active at a time. If multi-wallet support is added, switch to tracking
// * the connectedWallets array instead of primaryWallet.
const MAX_WALLET_CACHE_SIZE = 100;

function WalletTracker() {
  const { address } = useAccount();
  const { primaryWallet } = useDynamicContext();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!address || !userId) return;

    let cancelled = false;

    const normalizedAddress = address.toLowerCase();
    const walletType = primaryWallet?.key ?? 'unknown';
    const cacheKey = `${normalizedAddress}:${walletType}`;

    // Check localStorage cache to avoid unnecessary server calls
    const storageKey = `wallets_${userId}`;
    let cached = new Set<string>();
    try {
      cached = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      // localStorage blocked - proceed to server (it handles dedup)
    }

    if (cached.has(cacheKey)) return;

    handlePromise(
      trackWalletConnection({
        address,
        walletType: primaryWallet?.key ?? null
      })
    ).then(({ res, err }) => {
      if (cancelled || err || !res?.tracked) return;

      try {
        cached.add(cacheKey);
        if (cached.size > MAX_WALLET_CACHE_SIZE) cached = new Set([cacheKey]);
        localStorage.setItem(storageKey, JSON.stringify([...cached]));
      } catch {
        // Silently fail - server is source of truth
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address, primaryWallet?.key, userId]);

  return null;
}
