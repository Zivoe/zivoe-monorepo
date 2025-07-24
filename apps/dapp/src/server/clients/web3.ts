import 'server-only';

import { cache } from 'react';

import { type Chain, createPublicClient, fallback, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

import type { Network } from '@zivoe/contracts';

import { env } from '@/env.js';

export const getWeb3Client = cache((network: Network) => {
  let chain: Chain = mainnet;

  let primaryRpcUrl = env.NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY;
  let secondaryRpcUrl = env.NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY;

  if (network === 'SEPOLIA') {
    chain = sepolia;

    primaryRpcUrl = env.NEXT_PUBLIC_SEPOLIA_RPC_URL_PRIMARY;
    secondaryRpcUrl = env.NEXT_PUBLIC_SEPOLIA_RPC_URL_SECONDARY;
  }

  return createPublicClient({
    chain,
    transport: fallback([http(primaryRpcUrl, { batch: true }), http(secondaryRpcUrl, { batch: true })])
  });
});
