'use client';

import { useEffect, useRef } from 'react';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import * as Sentry from '@sentry/nextjs';

import { ACTIVE_CHAIN_IDS } from '@/lib/chains';

/**
 * Repairs Dynamic's stale network cache once per page load.
 *
 * Dynamic persists the environment settings (the dashboard's network list
 * included) in localStorage and, while a wallet is connected, rehydrates that
 * copy on load without refetching — by design, per its changelog. The wallet
 * connector snapshots the list at construction, so a chain enabled in the
 * dashboard AFTER a user connected is unknown to their session: every switch
 * to it fails with `could_not_find_network_mapping_for` until they disconnect
 * and reconnect. This validates the cache against the chains the app ships
 * and, on a gap, asks Dynamic for fresh settings; the SDK then rebuilds the
 * connectors and wagmi re-syncs, with no user action. In steady state the
 * check is a set comparison and costs no request. One attempt only: a chain
 * the dashboard truly lacks would otherwise refetch on every render.
 */
export function DynamicNetworkCacheRepair() {
  const { networkConfigurations, refetchProjectSettings } = useDynamicContext();
  const attempted = useRef(false);

  useEffect(() => {
    // `evm` is undefined until the settings (cached or fetched) are in.
    const evmNetworks = networkConfigurations?.evm;
    if (!evmNetworks || attempted.current) return;

    const cachedChainIds = new Set(evmNetworks.map((network) => Number(network.chainId)));
    if (ACTIVE_CHAIN_IDS.every((chainId) => cachedChainIds.has(chainId))) return;

    attempted.current = true;
    refetchProjectSettings().catch((error: unknown) => {
      Sentry.captureException(error, { tags: { flow: 'dynamic-network-cache-repair' } });
    });
  }, [networkConfigurations, refetchProjectSettings]);

  return null;
}
