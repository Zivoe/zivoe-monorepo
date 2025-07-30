import { revalidateTag } from 'next/cache';
import { NextRequest as Request, NextResponse as Response } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { PublicClient } from 'viem';
import { z } from 'zod';

import { Contracts, NETWORKS, getContracts } from '@zivoe/contracts';

import { getDb } from '@/server/clients/db';
import { getWeb3Client } from '@/server/clients/web3';
import { DEPOSIT_DAILY_DATA_TAG } from '@/server/data';
import { web3 } from '@/server/web3';

import { handle } from '@/lib/utils';

import { env } from '@/env';

import { ApiResponse, getLastBlockByDate, getUTCStartOfDay } from '../../utils';

const MONITOR_SLUG = 'deposit-daily-cron';

const bodySchema = z.object({
  network: z.enum(NETWORKS),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

type Body = z.infer<typeof bodySchema>;

const handler = async (req: Request): Promise<Response<ApiResponse>> => {
  // Request body should be a JSON object
  const body = await handle(req.json() as Promise<Body>);
  if (body.err || !body.data) return Response.json({ error: 'Request body not found' }, { status: 400 });

  // Validate the request body
  const parsedBody = bodySchema.safeParse(body.data);
  if (!parsedBody.success) return Response.json({ error: 'Network parameter is not valid' }, { status: 400 });

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

    if (start > end) return Response.json({ error: 'Start date must be before end date' }, { status: 400 });

    start = getUTCStartOfDay(start);
    end = getUTCStartOfDay(end);
    const todayStart = getUTCStartOfDay(today);

    if (start.getTime() === todayStart.getTime() || end.getTime() === todayStart.getTime())
      return Response.json({ error: 'Cannot process current day' }, { status: 400 });

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

    const failedResult = batchResults.find((result) => result.error || !result.data);
    if (failedResult) return Response.json({ error: failedResult.error ?? 'Unknown error' }, { status: 500 });

    const validResults = batchResults.filter((result): result is { data: DailyData } => result.data !== undefined);
    dailyDataToInsert.push(...validResults.map((result) => result.data));
  }

  const insertAllResult = await handle(db.daily.insertMany(dailyDataToInsert));
  if (insertAllResult.err) return Response.json({ error: 'Failed to insert daily data' }, { status: 500 });

  revalidateTag(DEPOSIT_DAILY_DATA_TAG);

  if (env.LANDING_PAGE_URL && env.LANDING_PAGE_REVALIDATE_API_KEY) {
    const { data, err } = await handle(
      fetch(`${env.LANDING_PAGE_URL}/api/revalidate/stats`, {
        method: 'POST',
        headers: {
          'X-API-Key': env.LANDING_PAGE_REVALIDATE_API_KEY
        }
      })
    );

    if (err || !data?.ok) return Response.json({ error: 'Failed to revalidate landing page' }, { status: 500 });
  }

  if (sentryCheckInId) {
    Sentry.captureCheckIn({
      checkInId: sentryCheckInId,
      monitorSlug: MONITOR_SLUG,
      status: 'ok'
    });
  }

  return Response.json({ success: true });
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
  const blockRes = await handle(getLastBlockByDate({ date, client }));
  if (blockRes.err || !blockRes.data) return { error: 'Failed to get block by date' };
  const blockNumber = BigInt(blockRes.data.block);

  const [indexPriceRes, aprRes, tvlRes, zSTTTotalSupplyRes] = await Promise.all([
    handle(web3.getIndexPrice({ client, contracts, blockNumber })),
    handle(web3.getAPY({ client, contracts, blockNumber })),
    handle(web3.getTVL({ client, contracts, blockNumber })),
    handle(web3.getZSTTTotalSupply({ client, contracts, blockNumber }))
  ]);

  if (indexPriceRes.err || !indexPriceRes.data) return { error: 'Failed to get index price' };
  if (aprRes.err || !aprRes.data) return { error: 'Failed to get APR' };
  if (tvlRes.err || !tvlRes.data) return { error: 'Failed to get TVL' };
  if (zSTTTotalSupplyRes.err || !zSTTTotalSupplyRes.data) return { error: 'Failed to get ZSTT total supply' };

  const data: DailyData = {
    timestamp: new Date(date.getTime() - 1),
    blockNumber: blockNumber.toString(),
    indexPrice: indexPriceRes.data.indexPrice,
    apy: aprRes.data,
    tvl: tvlRes.data.toString(),
    zSTTTotalSupply: zSTTTotalSupplyRes.data.toString(),
    vaultTotalAssets: indexPriceRes.data.vaultTotalAssets
  };

  return { data };
}

export const POST = verifySignatureAppRouter(handler);
