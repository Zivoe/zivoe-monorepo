import { type NextRequest, NextResponse } from 'next/server';

import { parseUnits } from 'viem';
import { z } from 'zod';

import { getContracts } from '@zivoe/contracts';

import { getDb } from '@/server/clients/db';
import { getPonder } from '@/server/clients/ponder';
import { getWeb3Client } from '@/server/clients/web3';
import { web3 } from '@/server/web3';

import { NETWORK } from '@/lib/constants';
import { ApiError, getEndOfDayUTC, handlePromise, withErrorHandler } from '@/lib/utils';

import { type ApiResponse } from '../utils';

const querySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
});

export type PortfolioData = {
  value: string | null;
  timestamp: string | null;
  snapshots: Array<{ timestamp: string; balance: string }>;
};

const handler = async (req: NextRequest): ApiResponse<PortfolioData> => {
  const searchParams = req.nextUrl.searchParams;
  const queryParams = {
    address: searchParams.get('address')
  };

  const parsedQuery = querySchema.safeParse(queryParams);
  if (!parsedQuery.success)
    throw new ApiError({ message: 'Address parameter is required and must be valid', status: 400, capture: false });

  const { address } = parsedQuery.data;
  const ponder = getPonder(NETWORK);
  const db = getDb(NETWORK);
  const contracts = getContracts(NETWORK);
  const web3Client = getWeb3Client(NETWORK);

  const snapshotsReq = handlePromise(
    ponder.query.balanceSnapshot.findMany({
      where: (balanceSnapshot, { and, eq, gt }) =>
        and(
          eq(balanceSnapshot.tokenAddress, contracts.zVLT),
          eq(balanceSnapshot.accountId, address),
          gt(balanceSnapshot.balance, 0n)
        ),
      orderBy: (balanceSnapshot, { asc }) => asc(balanceSnapshot.timestamp),
      columns: {
        timestamp: true,
        balance: true
      }
    })
  );

  const dailyReq = handlePromise(db.daily.find({}, { projection: { timestamp: 1, indexPrice: 1 } }).toArray());
  const currentIndexPriceReq = handlePromise(
    web3.getIndexPrice({ client: web3Client, contracts, blockNumber: undefined })
  );

  const [snapshotsRes, dailyRes, currentIndexPriceRes] = await Promise.all([
    snapshotsReq,
    dailyReq,
    currentIndexPriceReq
  ]);

  if (snapshotsRes.err || !snapshotsRes.res)
    throw new ApiError({ message: 'Error getting snapshots', exception: snapshotsRes.err });

  if (dailyRes.err || !dailyRes.res)
    throw new ApiError({ message: 'Error getting daily data', exception: dailyRes.err });

  if (currentIndexPriceRes.err || !currentIndexPriceRes.res)
    throw new ApiError({ message: 'Error getting current index price', exception: currentIndexPriceRes.err });

  const indexPriceMap = new Map(
    dailyRes.res.map((d) => {
      const timestampInSeconds = Math.floor(d.timestamp.getTime() / 1000).toString();
      return [timestampInSeconds, d.indexPrice];
    })
  );

  const currentDate = new Date();
  const currentEndOfDayUTC = getEndOfDayUTC(currentDate);
  const currentEndOfDayUTCInSeconds = Math.floor(currentEndOfDayUTC.getTime() / 1000).toString();

  const snapshots = snapshotsRes.res.map((snapshot) => {
    const snapshotTimestamp = snapshot.timestamp.toString();

    const indexPrice =
      snapshotTimestamp === currentEndOfDayUTCInSeconds
        ? currentIndexPriceRes.res.indexPrice
        : indexPriceMap.get(snapshotTimestamp);

    if (!indexPrice) throw new ApiError({ message: 'Error calculating portfolio value', status: 500 });

    const indexPriceWei = parseUnits(indexPrice.toFixed(6), 18);
    const adjustedBalance = (snapshot.balance * indexPriceWei) / BigInt(1e18);

    return {
      timestamp: snapshotTimestamp,
      balance: adjustedBalance.toString()
    };
  });

  const lastSnapshot = snapshots[snapshots.length - 1];
  const portfolioValue = lastSnapshot ? lastSnapshot.balance : null;
  const portfolioTimestamp = lastSnapshot ? currentEndOfDayUTCInSeconds : null;

  return NextResponse.json({
    success: true,
    data: { value: portfolioValue, timestamp: portfolioTimestamp, snapshots }
  });
};

export const GET = withErrorHandler('Error fetching portfolio data', handler);
