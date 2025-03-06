import { NextRequest as Request, NextResponse as Response } from 'next/server';

import { PublicClient, formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Contracts, NETWORKS, getContracts } from '@zivoe/contracts';
import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { handle } from '@/lib/utils';

import { getDb } from '@/app/server/clients/db';
import { getWeb3Client } from '@/app/server/clients/web3';

import { ApiResponse, getLastBlockByDate, getUTCStartOfDay } from '../../utils';

const bodySchema = z.object({
  network: z.enum(NETWORKS)
});

type Body = z.infer<typeof bodySchema>;

export async function POST(req: Request): Promise<Response<ApiResponse>> {
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

  // Get index price
  const blockNumber = BigInt(blockRes.data.block);
  const indexPriceRes = await handle(getIndexPrice({ client, contracts, blockNumber }));
  if (indexPriceRes.err || !indexPriceRes.data)
    return Response.json({ error: 'Failed to get index price' }, { status: 500 });

  // Insert daily data
  const dbTimestamp = new Date(date.getTime() - 1);
  const insertRes = await handle(db.daily.insertOne({ timestamp: dbTimestamp, indexPrice: indexPriceRes.data }));
  if (insertRes.err) return Response.json({ error: 'Failed to insert daily data' }, { status: 500 });

  return Response.json({ success: true });
}

const getIndexPrice = async ({
  client,
  contracts,
  blockNumber
}: {
  client: PublicClient;
  contracts: Contracts;
  blockNumber: bigint;
}) => {
  const totalSupply = await client.readContract({
    address: contracts.ZIVOE_VAULT,
    abi: zivoeVaultAbi,
    functionName: 'totalSupply'
  });

  const totalAssets = await client.readContract({
    address: contracts.ZIVOE_VAULT,
    abi: zivoeVaultAbi,
    functionName: 'totalAssets',
    blockNumber
  });

  const amount = parseUnits(totalAssets.toString(), 6);
  const indexPrice = Number(formatUnits(amount / totalSupply, 6));

  return indexPrice;
};
