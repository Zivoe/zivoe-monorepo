import { NextRequest, NextResponse } from 'next/server';

import { Ratelimit } from '@upstash/ratelimit';
import { ipAddress } from '@vercel/functions';
import { formatUnits } from 'viem';

import { CONTRACTS } from '@zivoe/contracts';
import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { redis } from '@/server/clients/redis';
import { getWeb3Client } from '@/server/clients/web3';

import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

const DEFAULT_ERROR_MESSAGE = 'Error getting zVLT supply';

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.fixedWindow(15, '30 m')
});

const handler = async (req: NextRequest) => {
  const headers = new Headers();

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
  const client = getWeb3Client();

  const supply = await handlePromise(
    client.readContract({
      address: CONTRACTS.zVLT,
      abi: zivoeVaultAbi,
      functionName: 'totalSupply'
    })
  );

  if (supply.err) throw new ApiError({ message: DEFAULT_ERROR_MESSAGE, exception: supply.err });
  if (!supply.res) throw new ApiError({ message: DEFAULT_ERROR_MESSAGE, exception: 'No supply result' });

  const result = formatUnits(supply.res, 18);
  return NextResponse.json({ result });
};

export const GET = withErrorHandler(DEFAULT_ERROR_MESSAGE, handler);
