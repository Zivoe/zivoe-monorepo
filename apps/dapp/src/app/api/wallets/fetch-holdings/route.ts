import { NextRequest, NextResponse } from 'next/server';

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { eq, sql } from 'drizzle-orm';
import { isAddress } from 'viem';

import { authDb } from '@/server/clients/auth-db';
import { fetchPortfolios } from '@/server/clients/zapper';
import { walletHoldings } from '@/server/db/schema';

import { roundTo4, withErrorHandler } from '@/lib/utils';

import { type ApiResponse } from '../../utils';

type FetchResult = {
  address: string;
  updated: boolean;
  totalValueUsd?: number;
};

const handler = async (req: NextRequest): ApiResponse<FetchResult> => {
  const body = await req.json();
  const address = body?.address;

  if (!address || typeof address !== 'string' || !isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  const normalizedAddress = address.toLowerCase();

  // Check if holdings already exist (idempotency for QStash retries)
  const [existing] = await authDb
    .select({ totalValueUsd: walletHoldings.totalValueUsd })
    .from(walletHoldings)
    .where(eq(walletHoldings.address, normalizedAddress));

  if (existing?.totalValueUsd !== null && existing?.totalValueUsd !== undefined) {
    return NextResponse.json({
      success: true,
      data: {
        address: normalizedAddress,
        updated: false,
        totalValueUsd: existing.totalValueUsd
      }
    });
  }

  const portfolios = await fetchPortfolios([normalizedAddress]);
  const portfolio = portfolios.get(normalizedAddress);

  const tokenBalanceUsd = roundTo4(portfolio?.tokenBalanceUSD ?? 0);
  const defiBalanceUsd = roundTo4(portfolio?.appBalanceUSD ?? 0);
  const totalValueUsd = roundTo4(tokenBalanceUsd + defiBalanceUsd);

  const holdingsData = {
    totalValueUsd,
    tokenBalanceUsd,
    defiBalanceUsd,
    holdingsUpdatedAt: sql`now()`
  };

  await authDb
    .insert(walletHoldings)
    .values({ address: normalizedAddress, ...holdingsData })
    .onConflictDoUpdate({
      target: walletHoldings.address,
      set: holdingsData
    });

  return NextResponse.json({
    success: true,
    data: {
      address: normalizedAddress,
      updated: true,
      totalValueUsd
    }
  });
};

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error fetching wallet holdings', handler)(req);
});
