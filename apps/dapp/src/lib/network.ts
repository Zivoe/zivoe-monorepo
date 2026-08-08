import { mainnet, sepolia } from 'viem/chains';

import { env } from '@/env';

// One network per deployment: NEXT_PUBLIC_NETWORK selects the single chain and
// its fallback RPC URLs for every web3 client in the app (wagmi, server reads,
// and the Centrifuge SDK).
export const NETWORK_CHAIN = env.NEXT_PUBLIC_NETWORK === 'mainnet' ? mainnet : sepolia;

export const NETWORK_RPC_URLS = (
  env.NEXT_PUBLIC_NETWORK === 'mainnet'
    ? [env.NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY, env.NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY]
    : [env.NEXT_PUBLIC_SEPOLIA_RPC_URL_PRIMARY, env.NEXT_PUBLIC_SEPOLIA_RPC_URL_SECONDARY]
).filter((url): url is string => Boolean(url));
