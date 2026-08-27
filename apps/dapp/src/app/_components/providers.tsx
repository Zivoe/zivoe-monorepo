'use client';

import { type ReactNode, useEffect } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import {
  type DynamicContextProps,
  DynamicContextProvider,
  type EvmNetwork,
  useDynamicContext
} from '@dynamic-labs/sdk-react-core';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import Intercom, { update } from '@intercom/messenger-js-sdk';
import * as Sentry from '@sentry/nextjs';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RouterProvider } from 'react-aria-components';
import { type Chain } from 'viem';
import { type State, WagmiProvider, cookieStorage, createConfig, createStorage, fallback, http } from 'wagmi';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Toaster } from '@zivoe/ui/core/sonner';

import { trackWalletConnection } from '@/server/actions/track-wallet-connection';

import { authClient, useSession } from '@/lib/auth-client';
import { ACTIVE_CHAINS, ACTIVE_CHAIN_IDS, getChainRpcUrls, getViemChain } from '@/lib/chains';
import { getQueryClient } from '@/lib/get-query-client';
import { handlePromise } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import { env } from '@/env';

import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

import { PostHogProvider } from './posthog';

/**
 * Chains Dynamic has no native support for, so its dashboard can never list
 * them and the app must supply the network entry itself. Everything but the
 * icon comes from the same viem chain wagmi and the Centrifuge SDK ride, so
 * one definition drives reads, transactions and the wallet's add-network
 * prompt. https://www.dynamic.xyz/docs/react/chains/adding-custom-networks
 */
const DYNAMIC_CUSTOM_NETWORKS: Array<EvmNetwork> = [toEvmNetwork('pharos', '/networks/pharos.svg')];

function toEvmNetwork(chain: CentrifugeChain, iconUrl: string): EvmNetwork {
  const viemChain = getViemChain(chain);

  return {
    chainId: viemChain.id,
    networkId: viemChain.id,
    name: viemChain.name,
    vanityName: CHAIN_DISPLAY[chain].label,
    nativeCurrency: viemChain.nativeCurrency,
    // The wallet persists whatever endpoints it is handed, for every app the
    // user touches on this chain — so it gets the chain's public RPCs, and our
    // Alchemy endpoint stays app-side (getChainRpcUrls).
    rpcUrls: [...viemChain.rpcUrls.default.http],
    blockExplorerUrls: viemChain.blockExplorers ? [viemChain.blockExplorers.default.url] : [],
    iconUrls: [iconUrl]
  };
}

const DYNAMIC_SETTINGS: DynamicContextProps['settings'] = {
  environmentId: env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
  walletConnectors: [EthereumWalletConnectors],
  initialAuthenticationMode: 'connect-only',
  networkValidationMode: 'always',
  appName: 'Zivoe',
  mobileExperience: 'redirect',
  overrides: {
    // Filters Dynamic's dashboard-provided list, so a dashboard-supported
    // chain must ALSO be enabled there to reach the app, then appends the
    // chains Dynamic cannot supply. Both halves are gated on ACTIVE_CHAIN_IDS,
    // so a testnet deployment advertises no mainnet-only custom network; the
    // dedupe keeps the list single-entry per chain should Dynamic ever ship
    // native support for one of them.
    evmNetworks: (networks) => {
      const fromDashboard = networks.filter((network) => ACTIVE_CHAIN_IDS.includes(Number(network.chainId)));
      const dashboardChainIds = new Set(fromDashboard.map((network) => Number(network.chainId)));

      return [
        ...fromDashboard,
        ...DYNAMIC_CUSTOM_NETWORKS.filter(
          (network) => ACTIVE_CHAIN_IDS.includes(network.chainId) && !dashboardChainIds.has(network.chainId)
        )
      ];
    }
  }
};

const activeViemChains = ACTIVE_CHAINS.map(getViemChain) as [Chain, ...Array<Chain>];

export const wagmiConfig = createConfig({
  chains: activeViemChains,
  multiInjectedProviderDiscovery: false,
  ssr: true,
  pollingInterval: 2_000,
  storage: createStorage({
    storage: cookieStorage
  }),
  transports: Object.fromEntries(
    ACTIVE_CHAINS.map((chain) => [getViemChain(chain).id, fallback(getChainRpcUrls(chain).map((url) => http(url)))])
  )
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
  const queryClient = getQueryClient();

  useEffect(() => {
    Intercom({ app_id: env.NEXT_PUBLIC_INTERCOM_APP_ID });
  }, []);

  useEffect(() => {
    update({});
  }, [pathname]);

  // Refresh the signed cache cookie as RSC are not able to do it
  // https://www.better-auth.com/docs/integrations/next#rsc-and-server-actions
  useEffect(() => {
    void authClient.getSession();
  }, [pathname]);

  return (
    <>
      <RouterProvider navigate={(path) => router.push(path)}>
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

const MAX_WALLET_CACHE_SIZE = 100;

// * Relies on connect-only mode, where only one wallet is active at a time. If
// * multi-wallet support is added, track the connectedWallets array instead of
// * primaryWallet.
function WalletTracker() {
  const { address } = useAccount();
  const { primaryWallet } = useDynamicContext();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!address || !userId) return;

    const normalizedAddress = address.toLowerCase();
    const walletType = primaryWallet?.key ?? 'unknown';
    const cacheKey = `${normalizedAddress}:${walletType}`;
    const storageKey = `wallets_${userId}`;

    // Avoids a server call on every mount for a wallet already tracked.
    try {
      const cached = new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
      if (cached.has(cacheKey)) return;
    } catch {
      // localStorage blocked — server handles dedup
    }

    void handlePromise(
      trackWalletConnection({
        address,
        walletType: primaryWallet?.key ?? null
      })
    ).then(({ res, err }) => {
      if (err || !res?.tracked) return;

      try {
        let fresh = new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
        fresh.add(cacheKey);
        if (fresh.size > MAX_WALLET_CACHE_SIZE) fresh = new Set([cacheKey]);
        localStorage.setItem(storageKey, JSON.stringify([...fresh]));
      } catch {
        // Silently fail — server is source of truth
      }
    });
  }, [address, primaryWallet?.key, userId]);

  return null;
}
