import { NextRequest as Request, NextResponse as Response } from 'next/server';

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { PublicClient, formatUnits, parseUnits } from 'viem';
import { z } from 'zod';

import { Contracts, NETWORKS, getContracts } from '@zivoe/contracts';
import { zivoeGlobalsAbi, zivoeRewardsAbi, zivoeTrancheTokenAbi, zivoeVaultAbi } from '@zivoe/contracts/abis';

import { DAYS_PER_YEAR, DAY_IN_SECONDS, handle } from '@/lib/utils';

import { getDb } from '@/app/server/clients/db';
import { getWeb3Client } from '@/app/server/clients/web3';

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
  const indexPriceRes = await handle(getIndexPrice({ client, contracts, blockNumber }));
  if (indexPriceRes.err || !indexPriceRes.data)
    return Response.json({ error: 'Failed to get index price' }, { status: 500 });

  // Get APR
  const aprRes = await handle(getAPY({ client, contracts, blockNumber }));
  if (aprRes.err || !aprRes.data) return Response.json({ error: 'Failed to get APR' }, { status: 500 });

  // Get TVL
  const tvlRes = await handle(getTVL({ client, contracts, blockNumber }));
  if (tvlRes.err || !tvlRes.data) return Response.json({ error: 'Failed to get TVL' }, { status: 500 });

  // Get ZSTT total supply
  const zSTTTotalSupplyRes = await handle(getZSTTTotalSupply({ client, contracts, blockNumber }));
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

  const vaultTotalAssets = await client.readContract({
    address: contracts.ZIVOE_VAULT,
    abi: zivoeVaultAbi,
    functionName: 'totalAssets',
    blockNumber
  });

  const amount = parseUnits(vaultTotalAssets.toString(), 6);
  const indexPrice = Number(formatUnits(amount / totalSupply, 6));

  return { indexPrice, vaultTotalAssets };
};

const COMPOUNDING_PERIOD = 15;

const getAPY = async ({
  client,
  contracts,
  blockNumber
}: {
  client: PublicClient;
  contracts: Contracts;
  blockNumber: bigint;
}) => {
  const rewardRateRes = await client.readContract({
    address: contracts.stSTT,
    abi: zivoeRewardsAbi,
    functionName: 'rewardData',
    args: [contracts.USDC],
    blockNumber
  });

  const totalSupplyRes = await client.readContract({
    address: contracts.stSTT,
    abi: zivoeRewardsAbi,
    functionName: 'totalSupply',
    blockNumber
  });

  const rewardRate = Number(rewardRateRes[2]);
  const totalSupply = Number(totalSupplyRes);

  const rewardRatePerDay = rewardRate * DAY_IN_SECONDS;
  const rewardRatePerYear = rewardRatePerDay * DAYS_PER_YEAR;
  const apr = rewardRatePerYear / totalSupply;

  const dailyRate = apr / 100 / DAYS_PER_YEAR;
  const periodRate = dailyRate * COMPOUNDING_PERIOD;
  const apy = ((1 + periodRate) ** (DAYS_PER_YEAR / COMPOUNDING_PERIOD) - 1) * 100;

  return Number(apy.toFixed(6));
};

const getTVL = async ({
  client,
  contracts,
  blockNumber
}: {
  client: PublicClient;
  contracts: Contracts;
  blockNumber: bigint;
}) => {
  const totalSupply = await client.readContract({
    address: contracts.GBL,
    abi: zivoeGlobalsAbi,
    functionName: 'adjustedSupplies',
    blockNumber
  });

  return totalSupply[0] + totalSupply[1];
};

const getZSTTTotalSupply = async ({
  client,
  contracts,
  blockNumber
}: {
  client: PublicClient;
  contracts: Contracts;
  blockNumber: bigint;
}) => {
  const totalSupply = await client.readContract({
    address: contracts.zSTT,
    abi: zivoeTrancheTokenAbi,
    functionName: 'totalSupply',
    blockNumber
  });

  return totalSupply;
};

export const POST = verifySignatureAppRouter(handler);
