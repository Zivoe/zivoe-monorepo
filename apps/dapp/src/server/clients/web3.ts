import 'server-only';

import { cache } from 'react';

import { createPublicClient, fallback, http } from 'viem';

import { NETWORK_CHAIN, NETWORK_RPC_URLS } from '@/lib/network';

export const getWeb3Client = cache(() => {
  return createPublicClient({
    chain: NETWORK_CHAIN,
    transport:
      NETWORK_RPC_URLS.length > 0 ? fallback(NETWORK_RPC_URLS.map((url) => http(url, { batch: true }))) : http()
  });
});
