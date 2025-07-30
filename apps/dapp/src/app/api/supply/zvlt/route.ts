import { NextRequest, NextResponse } from 'next/server';

import { Ratelimit } from '@upstash/ratelimit';
import { ipAddress } from '@vercel/functions';
import { formatUnits } from 'viem';

import { getContracts } from '@zivoe/contracts';
import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { redis } from '@/server/clients/redis';
import { getWeb3Client } from '@/server/clients/web3';

import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../../utils';

const DEFAULT_ERROR_MESSAGE = 'Error getting zVLT supply';

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(25, '30 m')
});

const handler = async (req: NextRequest): ApiResponse<string> => {
  const headers = new Headers();

  // Verify CoinGecko headers
  const requestedWith = req.headers.get('X-Requested-With');
  const userAgent = req.headers.get('User-Agent');

  if (requestedWith !== 'com.coingecko' || userAgent !== 'CoinGecko +https://coingecko.com/')
    throw new ApiError({ message: 'Unauthorized request', status: 403, capture: false });

  // Rate limit based on IP address
  const ip = ipAddress(req) ?? '127.0.0.1';
  const rateLimit = await handlePromise(ratelimit.limit(`cg:${ip}`));

  if (rateLimit.err) throw new ApiError({ message: DEFAULT_ERROR_MESSAGE, exception: rateLimit.err });
  if (!rateLimit.res)
    throw new ApiError({ message: DEFAULT_ERROR_MESSAGE, exception: 'Error getting rate limit data' });

  headers.set('X-RateLimit-Limit', rateLimit.res.limit.toString());
  headers.set('X-RateLimit-Remaining', rateLimit.res.remaining.toString());

  if (!rateLimit.res.success)
    throw new ApiError({ message: 'The request has been rate limited.', status: 429, headers });

  // Get zVLT supply
  const network = env.NEXT_PUBLIC_NETWORK;
  const client = getWeb3Client(network);
  const contracts = getContracts(network);

  const supply = await handlePromise(
    client.readContract({
      address: contracts.zVLT,
      abi: zivoeVaultAbi,
      functionName: 'totalSupply'
    })
  );

  if (supply.err) throw new ApiError({ message: DEFAULT_ERROR_MESSAGE, exception: supply.err });
  if (!supply.res) throw new ApiError({ message: DEFAULT_ERROR_MESSAGE, exception: 'No supply result' });

  const data = formatUnits(supply.res, 18);
  return NextResponse.json({ success: true, data });
};

export const GET = withErrorHandler(DEFAULT_ERROR_MESSAGE, handler);
