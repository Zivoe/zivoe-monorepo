import { type NextRequest, NextResponse } from 'next/server';

import { parseUnits } from 'viem';
import { z } from 'zod';

import { getContracts } from '@zivoe/contracts';

import { getDb } from '@/server/clients/db';
import { getPonder } from '@/server/clients/ponder';
import { getWeb3Client } from '@/server/clients/web3';
import { web3 } from '@/server/web3';

import { NETWORK } from '@/lib/constants';
import { ApiError, DAY_IN_SECONDS, getEndOfDayUTC, handlePromise, withErrorHandler } from '@/lib/utils';

import { type ApiResponse } from '../utils';

const querySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
});

type Snapshot = {
  timestamp: string;
  balance: string;
};

export type PortfolioData = {
  timestamp: string | null;
  value: string | null;
  zVLTBalance: string | null;
  snapshots: Array<Snapshot>;
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

  const filledSnapshots = processAndFillSnapshots(
    snapshotsRes.res,
    indexPriceMap,
    currentIndexPriceRes.res.indexPrice,
    currentEndOfDayUTCInSeconds
  );

  const lastSnapshot = filledSnapshots[filledSnapshots.length - 1];
  const portfolioValue = lastSnapshot ? lastSnapshot.balance : null;
  const portfolioTimestamp = lastSnapshot ? currentEndOfDayUTCInSeconds : null;

  const zVLTBalance = snapshotsRes.res[snapshotsRes.res.length - 1]?.balance?.toString() ?? null;

  return NextResponse.json({
    success: true,
    data: { timestamp: portfolioTimestamp, value: portfolioValue, zVLTBalance, snapshots: filledSnapshots }
  });
};

function processAndFillSnapshots(
  rawSnapshots: Array<{ timestamp: bigint; balance: bigint }>,
  indexPriceMap: Map<string, number>,
  currentIndexPrice: number,
  currentEndOfDayUTCInSeconds: string
) {
  if (rawSnapshots.length === 0) return [];

  const result: Array<Snapshot> = [];
  const snapshotMap = new Map(rawSnapshots.map((s) => [s.timestamp.toString(), s.balance]));

  const firstSnapshot = rawSnapshots[0];
  if (!firstSnapshot) return [];

  const firstTimestamp = Number(firstSnapshot.timestamp.toString());
  const endTimestamp = Number(currentEndOfDayUTCInSeconds);

  let currentTimestamp = firstTimestamp;
  let lastRawBalance = firstSnapshot.balance;

  while (currentTimestamp <= endTimestamp) {
    const timestampStr = currentTimestamp.toString();

    // Update raw balance if we have a snapshot for this day
    const snapshotBalance = snapshotMap.get(timestampStr);
    if (snapshotBalance !== undefined) {
      lastRawBalance = snapshotBalance;
    }

    // Get index price for this specific day
    const indexPrice =
      timestampStr === currentEndOfDayUTCInSeconds ? currentIndexPrice : indexPriceMap.get(timestampStr);

    if (!indexPrice) {
      throw new ApiError({
        message: `Error calculating portfolio value: missing index price for ${timestampStr}`,
        status: 500
      });
    }

    // Calculate adjusted balance for this day
    const indexPriceWei = parseUnits(indexPrice.toFixed(6), 18);
    const adjustedBalance = (lastRawBalance * indexPriceWei) / BigInt(1e18);

    result.push({
      timestamp: timestampStr,
      balance: adjustedBalance.toString()
    });

    currentTimestamp += DAY_IN_SECONDS; // Move to next day
  }

  return result;
}

export const GET = withErrorHandler('Error fetching portfolio data', handler);
