import { PublicClient } from 'viem';

import { Contracts } from '@zivoe/contracts';

import { web3 } from '@/server/web3';

import { ApiError, handlePromise } from '@/lib/utils';

import { DailyData } from '@/types';

import { getLastBlockByDate } from '../../utils';

/**
 * Unified function to collect daily data at a specific block.
 * Handles both historical backfill and live hourly modes.
 *
 * @param blockTimestamp - The time at which to find the block (EthDater finds block BEFORE this time)
 * @param recordTimestamp - The timestamp to store in DB (end-of-day for the target day)
 */
export async function collectDailyData({
  client,
  contracts,
  blockTimestamp,
  recordTimestamp
}: {
  client: PublicClient;
  contracts: Contracts;
  blockTimestamp: Date;
  recordTimestamp: Date;
}) {
  const blockRes = await handlePromise(getLastBlockByDate({ date: blockTimestamp, client }));
  if (blockRes.err || !blockRes.res) {
    throw new ApiError({ message: 'Failed to get block by date', exception: blockRes.err });
  }

  const blockNumber = BigInt(blockRes.res.block);

  const [indexPriceRes, aprRes, tvlRes, zSTTTotalSupplyRes, loansRevenueRes] = await Promise.all([
    handlePromise(web3.getIndexPrice({ client, contracts, blockNumber })),
    handlePromise(web3.getAPY({ client, contracts, blockNumber })),
    handlePromise(web3.getTVL({ client, contracts, blockNumber })),
    handlePromise(web3.getZSTTTotalSupply({ client, contracts, blockNumber })),
    handlePromise(web3.getLoansRevenue({ client, contracts, blockNumber }))
  ]);

  if (indexPriceRes.err || indexPriceRes.res === undefined)
    throw new ApiError({ message: 'Failed to get index price', exception: indexPriceRes.err });

  if (aprRes.err || aprRes.res === undefined)
    throw new ApiError({ message: 'Failed to get APR', exception: aprRes.err });

  if (tvlRes.err || tvlRes.res === undefined)
    throw new ApiError({ message: 'Failed to get TVL', exception: tvlRes.err });

  if (zSTTTotalSupplyRes.err || zSTTTotalSupplyRes.res === undefined)
    throw new ApiError({ message: 'Failed to get zSTT total supply', exception: zSTTTotalSupplyRes.err });

  if (loansRevenueRes.err || loansRevenueRes.res === undefined)
    throw new ApiError({ message: 'Failed to get loans revenue', exception: loansRevenueRes.err });

  const data: DailyData = {
    timestamp: recordTimestamp,
    blockNumber: blockNumber.toString(),
    indexPrice: indexPriceRes.res.indexPrice,
    apy: aprRes.res,
    tvl: tvlRes.res,
    zSTTTotalSupply: zSTTTotalSupplyRes.res.toString(),
    vaultTotalAssets: indexPriceRes.res.vaultTotalAssets,
    loansRevenue: loansRevenueRes.res
  };

  return data;
}
