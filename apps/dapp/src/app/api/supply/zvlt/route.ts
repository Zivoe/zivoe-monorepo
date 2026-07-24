import { type NextRequest, NextResponse } from 'next/server';

import { Ratelimit } from '@upstash/ratelimit';
import { ipAddress } from '@vercel/functions';
import { erc20Abi, formatUnits } from 'viem';

import { CENTRIFUGE_CONFIG } from '@/centrifuge/config';

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

  // CoinGecko consumes this response shape — keep it stable.
  const client = getWeb3Client();

  const supply = await handlePromise(
    client.readContract({
      address: CENTRIFUGE_CONFIG.shareToken.address,
      abi: erc20Abi,
      functionName: 'totalSupply'
    })
  );

  if (supply.err) throw new ApiError({ message: DEFAULT_ERROR_MESSAGE, exception: supply.err });
  if (supply.res === undefined) throw new ApiError({ message: DEFAULT_ERROR_MESSAGE, exception: 'No supply result' });

  const result = formatUnits(supply.res, CENTRIFUGE_CONFIG.shareToken.decimals);
  return NextResponse.json({ result });
};

export const GET = withErrorHandler(DEFAULT_ERROR_MESSAGE, handler);
