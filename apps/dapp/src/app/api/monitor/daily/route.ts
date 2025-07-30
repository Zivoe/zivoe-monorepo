import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { PublicClient } from 'viem';
import { z } from 'zod';

import { Contracts, NETWORKS, getContracts } from '@zivoe/contracts';

import { getDb } from '@/server/clients/db';
import { getWeb3Client } from '@/server/clients/web3';
import { DEPOSIT_DAILY_DATA_TAG } from '@/server/data';
import { web3 } from '@/server/web3';

import { ApiError, handlePromise, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { ApiResponse, getLastBlockByDate, getUTCStartOfDay } from '../../utils';

const MONITOR_SLUG = 'deposit-daily-cron';

const bodySchema = z.object({
  network: z.enum(NETWORKS),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

type Body = z.infer<typeof bodySchema>;

const handler = async (req: NextRequest): ApiResponse<string> => {
  // Request body should be a JSON object
  const body = await handlePromise(req.json() as Promise<Body>);
  if (body.err || !body.res) throw new ApiError({ message: 'Request body not found', status: 400, capture: false });

  // Validate the request body
  const parsedBody = bodySchema.safeParse(body.res);
  if (!parsedBody.success)
    throw new ApiError({ message: 'Network parameter is not valid', status: 400, capture: false });

  // Get context
  const { network, startDate, endDate } = parsedBody.data;

  let sentryCheckInId: string | null = null;
  if (network === 'MAINNET') {
    sentryCheckInId = Sentry.captureCheckIn({
      monitorSlug: MONITOR_SLUG,
      status: 'in_progress'
    });
  }

  const client = getWeb3Client(network);
  const contracts = getContracts(network);
  const db = getDb(network);

  // Determine date range to process
  let start: Date, end: Date;
  let today = new Date();

  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);

    if (start > end) throw new ApiError({ message: 'Start date must be before end date', status: 400, capture: false });

    start = getUTCStartOfDay(start);
    end = getUTCStartOfDay(end);
    const todayStart = getUTCStartOfDay(today);

    if (start.getTime() === todayStart.getTime() || end.getTime() === todayStart.getTime())
      throw new ApiError({ message: 'Cannot process current day', status: 400, capture: false });

    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
  } else {
    today = getUTCStartOfDay(today);
    start = new Date(today);
    end = new Date(today);
  }

  const datesToProcess: Date[] = [];

  while (start <= end) {
    datesToProcess.push(new Date(start));
    start.setDate(start.getDate() + 1);
  }

  const BATCH_SIZE = 30;
  const dailyDataToInsert: Array<DailyData> = [];

  for (let i = 0; i < datesToProcess.length; i += BATCH_SIZE) {
    const batch = datesToProcess.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((date) => collectDailyData({ date, client, contracts })));

    const validResults = batchResults.filter((result): result is { data: DailyData } => result.data !== undefined);
    dailyDataToInsert.push(...validResults.map((result) => result.data));
  }

  const insertAllResult = await handlePromise(db.daily.insertMany(dailyDataToInsert));
  if (insertAllResult.err)
    throw new ApiError({ message: 'Failed to insert daily data', status: 500, exception: insertAllResult.err });

  revalidateTag(DEPOSIT_DAILY_DATA_TAG);

  if (env.LANDING_PAGE_URL && env.LANDING_PAGE_REVALIDATE_API_KEY) {
    const { res, err } = await handlePromise(
      fetch(`${env.LANDING_PAGE_URL}/api/revalidate/stats`, {
        method: 'POST',
        headers: {
          'X-API-Key': env.LANDING_PAGE_REVALIDATE_API_KEY
        }
      })
    );

    if (err || !res?.ok)
      throw new ApiError({ message: 'Failed to revalidate landing page', status: 500, exception: err });
  }

  if (sentryCheckInId) {
    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: 'ok'
    });
  }

  return NextResponse.json({ success: true, data: 'Deposit daily data collected' });
};

type DailyData = {
  timestamp: Date;
  blockNumber: string;
  indexPrice: number;
  apy: number;
  tvl: string;
  zSTTTotalSupply: string;
  vaultTotalAssets: string;
};

async function collectDailyData({
  date,
  client,
  contracts
}: {
  date: Date;
  client: PublicClient;
  contracts: Contracts;
}) {
  // Get block of the start of the day
  const blockRes = await handlePromise(getLastBlockByDate({ date, client }));
  if (blockRes.err || !blockRes.res) throw new ApiError({ message: 'Failed to get block by date' });

  const blockNumber = BigInt(blockRes.res.block);

  const [indexPriceRes, aprRes, tvlRes, zSTTTotalSupplyRes] = await Promise.all([
    handlePromise(web3.getIndexPrice({ client, contracts, blockNumber })),
    handlePromise(web3.getAPY({ client, contracts, blockNumber })),
    handlePromise(web3.getTVL({ client, contracts, blockNumber })),
    handlePromise(web3.getZSTTTotalSupply({ client, contracts, blockNumber }))
  ]);

  if (indexPriceRes.err || indexPriceRes.res === undefined)
    throw new ApiError({ message: 'Failed to get index price', exception: indexPriceRes.err });

  if (aprRes.err || aprRes.res === undefined)
    throw new ApiError({ message: 'Failed to get APR', exception: aprRes.err });

  if (tvlRes.err || tvlRes.res === undefined)
    throw new ApiError({ message: 'Failed to get TVL', exception: tvlRes.err });

  if (zSTTTotalSupplyRes.err || zSTTTotalSupplyRes.res === undefined)
    throw new ApiError({ message: 'Failed to get zSTT total supply', exception: zSTTTotalSupplyRes.err });

  const data: DailyData = {
    timestamp: new Date(date.getTime() - 1),
    blockNumber: blockNumber.toString(),
    indexPrice: indexPriceRes.res.indexPrice,
    apy: aprRes.res,
    tvl: tvlRes.res.toString(),
    zSTTTotalSupply: zSTTTotalSupplyRes.res.toString(),
    vaultTotalAssets: indexPriceRes.res.vaultTotalAssets
  };

  return { data };
}

export const POST = verifySignatureAppRouter(async (req: NextRequest) => {
  return withErrorHandler('Error collecting daily data', handler)(req) as unknown as NextResponse;
});
