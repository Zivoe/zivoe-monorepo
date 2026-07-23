import 'server-only';

import { cache } from 'react';

import { createPublicClient, fallback, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

import { env } from '@/env.js';

// One network per deployment: NEXT_PUBLIC_NETWORK selects the chain server
// reads run against.
const NETWORK_CHAIN = env.NEXT_PUBLIC_NETWORK === 'mainnet' ? mainnet : sepolia;

const RPC_URLS = (
  env.NEXT_PUBLIC_NETWORK === 'mainnet'
    ? [env.NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY, env.NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY]
    : [env.NEXT_PUBLIC_SEPOLIA_RPC_URL_PRIMARY, env.NEXT_PUBLIC_SEPOLIA_RPC_URL_SECONDARY]
).filter((url): url is string => Boolean(url));

export const getWeb3Client = cache(() => {
  return createPublicClient({
    chain: NETWORK_CHAIN,
    transport: RPC_URLS.length > 0 ? fallback(RPC_URLS.map((url) => http(url, { batch: true }))) : http()
  });
});
