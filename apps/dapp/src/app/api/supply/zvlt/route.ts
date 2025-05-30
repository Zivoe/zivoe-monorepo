import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ipAddress } from '@vercel/functions';
import { formatUnits } from 'viem';

import { getContracts } from '@zivoe/contracts';
import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { redis } from '@/server/clients/redis';
import { getWeb3Client } from '@/server/clients/web3';

import { env } from '@/env';

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(25, '30 m')
});

export const GET = async (req: Request) => {
  const headers = new Headers();

  // Verify CoinGecko headers
  const requestedWith = req.headers.get('X-Requested-With');
  const userAgent = req.headers.get('User-Agent');

  if (requestedWith !== 'com.coingecko' || userAgent !== 'CoinGecko +https://coingecko.com/')
    return Response.json({ message: 'Unauthorized request' }, { status: 403 });

  // Rate limit based on IP address
  const ip = ipAddress(req) ?? '127.0.0.1';
  const identifier = `cg:${ip}`;

  const rateLimitResult = await ratelimit.limit(identifier);
  headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
  headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());

  if (!rateLimitResult.success)
    return Response.json({ message: 'The request has been rate limited.' }, { headers, status: 429 });

  // Get zVLT supply
  const network = env.NEXT_PUBLIC_NETWORK;
  const client = getWeb3Client(network);
  const contracts = getContracts(network);

  const supply = await client.readContract({
    address: contracts.zVLT,
    abi: zivoeVaultAbi,
    functionName: 'totalSupply'
  });

  const result = formatUnits(supply, 18);
  return Response.json({ result });
};
