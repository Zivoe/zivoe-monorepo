'use client';

import { useMemo } from 'react';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';

import {
  type MembershipSummary,
  listMembershipTargets,
  readAddressesMembership,
  summarizeMembership
} from '@/server/wallet-link/wallet-link-membership';

import { queryKeys } from '@/lib/query-keys';

/**
 * How often the chain is re-read while some address is not yet whitelisted
 * everywhere, so ops' whitelist shows without a reload. Paused while the tab
 * is in the background; a return to the tab reads again once this has passed.
 */
const PENDING_REFETCH_MS = 5 * 60_000;

/**
 * Whitelist membership of the given addresses, read live from each active
 * chain in one pass — one `hook()` read and one multicall per share token,
 * whatever the number of addresses — through wagmi's public clients. The
 * same read and the same summary the server's reconcile uses, so the badge
 * and the email cannot disagree. A summary of `undefined` is still loading.
 */
export function useAddressesMembership(addresses: Array<Address>): Record<Address, MembershipSummary | undefined> {
  const config = useConfig();
  const targets = useMemo(listMembershipTargets, []);

  const { data } = useQuery({
    queryKey: queryKeys.app.walletLinkMembership({ addresses }),
    queryFn: () =>
      readAddressesMembership({
        addresses,
        targets,
        clientFor: (target) => getPublicClient(config, { chainId: target.chainId })
      }),
    enabled: addresses.length > 0,
    // The key holds the address list, so another address starts a new read.
    // An address the previous read never asked about stays `undefined` (loading).
    placeholderData: keepPreviousData,
    select: (membership) =>
      Object.fromEntries(
        addresses.flatMap((address) => {
          const answered = membership[address];
          return answered ? [[address, summarizeMembership(answered)]] : [];
        })
      ),
    staleTime: PENDING_REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const membership = query.state.data;
      const allWhitelisted =
        !!membership &&
        addresses.every((address) => summarizeMembership(membership[address] ?? []).status === 'whitelisted');
      return allWhitelisted ? false : PENDING_REFETCH_MS;
    },
    // A failed chain read is 'unknown' inside the summary, never a toast.
    meta: { skipErrorToast: true }
  });

  return data ?? {};
}
