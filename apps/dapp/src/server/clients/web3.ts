import 'server-only';

import { cache } from 'react';

import { createPublicClient, fallback, http } from 'viem';
import { mainnet } from 'viem/chains';

import { env } from '@/env.js';

export const getWeb3Client = cache(() => {
  return createPublicClient({
    chain: mainnet,
    transport: fallback([
      http(env.NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY, { batch: true }),
      http(env.NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY, { batch: true })
    ])
  });
});
