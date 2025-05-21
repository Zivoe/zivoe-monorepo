import 'server-only';

import { cache } from 'react';

import { type Chain, createPublicClient, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

import type { Network } from '@zivoe/contracts';

import { env } from '@/env.js';

export const getWeb3Client = cache((network: Network) => {
  let chain: Chain = mainnet;
  let url = 'https://eth-mainnet.g.alchemy.com/v2/';
  let apiKey = env.MAINNET_ALCHEMY_API_KEY;

  if (network === 'SEPOLIA') {
    chain = sepolia;
    url = 'https://eth-sepolia.g.alchemy.com/v2/';
    apiKey = env.SEPOLIA_ALCHEMY_API_KEY;
  }

  return createPublicClient({
    chain,
    transport: http(url, {
      batch: true,
      fetchOptions: {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        }
      }
    })
  });
});
