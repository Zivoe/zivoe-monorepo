import 'server-only';

import { cache } from 'react';

import { createPublicClient, fallback, http } from 'viem';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { DEFAULT_CHAIN, getChainRpcUrls, getViemChain } from '@/lib/network';

/**
 * Server viem client per chain, request-cached. Currently unreferenced by
 * live code (archived consumers only) — kept chain-parameterized so an
 * un-archived caller cannot silently read the wrong chain.
 */
export const getWeb3Client = cache((chain: CentrifugeChain = DEFAULT_CHAIN) => {
  return createPublicClient({
    chain: getViemChain(chain),
    transport: fallback(getChainRpcUrls(chain).map((url) => http(url, { batch: true })))
  });
});
