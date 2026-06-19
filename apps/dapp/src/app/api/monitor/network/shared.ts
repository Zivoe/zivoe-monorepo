import { revalidateTag } from 'next/cache';

import { type PublicClient } from 'viem';

import { type Contracts } from '@zivoe/contracts';
import { type ProtocolDailySnapshotInsert } from '@zivoe/database/schema';

import { PROTOCOL_DAILY_SNAPSHOT_TAG } from '@/server/data';
import { web3 } from '@/server/web3';

import { ApiError, handlePromise } from '@/lib/utils';

import { env } from '@/env';

import { getLastBlockByDate } from '../../utils';

/**
 * Unified function to collect a Protocol Daily Snapshot at a specific block.
 * Handles both historical backfill and live hourly modes.
 *
 * @param blockTimestamp - The time at which to find the block (EthDater finds block BEFORE this time)
 * @param recordTimestamp - The timestamp to store in DB (end-of-day for the target day)
 */
export async function collectProtocolDailySnapshot({
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

  const data: ProtocolDailySnapshotInsert = {
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

/**
 * Invalidates every cache that serves protocol daily snapshots: the dapp's
 * cache tag and the landing page's stats cache. Call after any write to the
 * snapshots table (hourly live collection, backfill/restore).
 */
export async function revalidateProtocolDailySnapshotCaches() {
  revalidateTag(PROTOCOL_DAILY_SNAPSHOT_TAG, { expire: 0 });

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
}
