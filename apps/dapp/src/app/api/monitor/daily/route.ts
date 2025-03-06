import { NextRequest as Request, NextResponse as Response } from 'next/server';

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { PublicClient } from 'viem';
import { z } from 'zod';

import { Contracts, NETWORKS, getContracts } from '@zivoe/contracts';

import { handle } from '@/lib/utils';

import { Db, getDb } from '@/app/server/clients/db';
import { getWeb3Client } from '@/app/server/clients/web3';
import { web3 } from '@/app/server/web3';

import { ApiResponse, getLastBlockByDate, getUTCStartOfDay } from '../../utils';

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
  const client = getWeb3Client({ network });
  const contracts = getContracts({ network });
  const db = getDb({ network });

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

  while (start <= end) {
    const { error } = await processDay({ date: start, client, contracts, db });
    if (error) return Response.json({ error }, { status: 500 });

    start.setDate(start.getDate() + 1);
  }

  return Response.json({ success: true });
};

async function processDay({
  date,
  client,
  contracts,
  db
}: {
  date: Date;
  client: PublicClient;
  contracts: Contracts;
  db: Db;
}) {
  // Get block of the start of the day
  const blockRes = await handle(getLastBlockByDate({ date, client }));
  if (blockRes.err || !blockRes.data) return { error: 'Failed to get block by date' };
  const blockNumber = BigInt(blockRes.data.block);

  // Get index price
  const indexPriceRes = await handle(web3.getIndexPrice({ client, contracts, blockNumber }));
  if (indexPriceRes.err || !indexPriceRes.data) return { error: 'Failed to get index price' };

  // Get APR
  const aprRes = await handle(web3.getAPY({ client, contracts, blockNumber }));
  if (aprRes.err || !aprRes.data) return { error: 'Failed to get APR' };

  // Get TVL
  const tvlRes = await handle(web3.getTVL({ client, contracts, blockNumber }));
  if (tvlRes.err || !tvlRes.data) return { error: 'Failed to get TVL' };

  // Get ZSTT total supply
  const zSTTTotalSupplyRes = await handle(web3.getZSTTTotalSupply({ client, contracts, blockNumber }));
  if (zSTTTotalSupplyRes.err || !zSTTTotalSupplyRes.data) return { error: 'Failed to get ZSTT total supply' };

  // Insert daily data
  const dbTimestamp = new Date(date.getTime() - 1);
  const insertRes = await handle(
    db.daily.insertOne({
      timestamp: dbTimestamp,
      blockNumber: blockNumber.toString(),
      indexPrice: indexPriceRes.data.indexPrice,
      apy: aprRes.data,
      tvl: tvlRes.data.toString(),
      zSTTTotalSupply: zSTTTotalSupplyRes.data.toString(),
      vaultTotalAssets: indexPriceRes.data.vaultTotalAssets
    })
  );
  if (insertRes.err) return { error: 'Failed to insert daily data' };

  return { success: true };
}

export const POST = handler;
