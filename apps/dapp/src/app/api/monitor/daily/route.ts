import { NextRequest as Request, NextResponse as Response } from 'next/server';

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { z } from 'zod';

import { NETWORKS, getContracts } from '@zivoe/contracts';

import { handle } from '@/lib/utils';

import { getDb } from '@/app/server/clients/db';
import { getWeb3Client } from '@/app/server/clients/web3';
import { web3 } from '@/app/server/web3';

import { ApiResponse, getLastBlockByDate, getUTCStartOfDay } from '../../utils';

const bodySchema = z.object({
  network: z.enum(NETWORKS)
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
  const { network } = parsedBody.data;
  const client = getWeb3Client({ network });
  const contracts = getContracts({ network });
  const db = getDb({ network });

  // Get block of the start of the day
  const date = getUTCStartOfDay(new Date());
  const blockRes = await handle(getLastBlockByDate({ date, client }));
  if (blockRes.err || !blockRes.data) return Response.json({ error: 'Failed to get block by date' }, { status: 500 });
  const blockNumber = BigInt(blockRes.data.block);

  //Get index price
  const indexPriceRes = await handle(web3.getIndexPrice({ client, contracts, blockNumber }));
  if (indexPriceRes.err || !indexPriceRes.data)
    return Response.json({ error: 'Failed to get index price' }, { status: 500 });

  // Get APR
  const aprRes = await handle(web3.getAPY({ client, contracts, blockNumber }));
  if (aprRes.err || !aprRes.data) return Response.json({ error: 'Failed to get APR' }, { status: 500 });

  // Get TVL
  const tvlRes = await handle(web3.getTVL({ client, contracts, blockNumber }));
  if (tvlRes.err || !tvlRes.data) return Response.json({ error: 'Failed to get TVL' }, { status: 500 });

  // Get ZSTT total supply
  const zSTTTotalSupplyRes = await handle(web3.getZSTTTotalSupply({ client, contracts, blockNumber }));
  if (zSTTTotalSupplyRes.err || !zSTTTotalSupplyRes.data)
    return Response.json({ error: 'Failed to get ZSTT total supply' }, { status: 500 });

  // Insert daily data
  const dbTimestamp = new Date(date.getTime() - 1);
  const insertRes = await handle(
    db.daily.insertOne({
      timestamp: dbTimestamp,
      indexPrice: indexPriceRes.data.indexPrice,
      apy: aprRes.data,
      tvl: tvlRes.data.toString(),
      zSTTTotalSupply: zSTTTotalSupplyRes.data.toString(),
      vaultTotalAssets: indexPriceRes.data.vaultTotalAssets
    })
  );
  if (insertRes.err) return Response.json({ error: 'Failed to insert daily data' }, { status: 500 });

  return Response.json({ success: true });
};

export const POST = verifySignatureAppRouter(handler);
