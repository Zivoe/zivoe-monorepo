import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { NETWORKS, getContracts } from '@zivoe/contracts';

import { getPonder } from '@/server/clients/ponder';
import { getWeb3Client } from '@/server/clients/web3';

import { ApiError, withErrorHandler } from '@/lib/utils';

import { env } from '@/env';

import { type ApiResponse } from '../utils';
import { getStakedTranchesHolders } from './data/staked-tranches-holders';
import { type TranchesDeposit, getTranchesDeposits } from './data/tranches-deposits';
import { type TranchesHolder } from './data/tranches-holders-utils';
import { getTranchesTokenHolders } from './data/tranches-token-holders';
import { type ZvltDeposit, getZVLTDeposits } from './data/zvlt-deposits';
import { type TokenHolder, getZVLTTokenHolders } from './data/zvlt-token-holders';

const querySchema = z.object({
  network: z.enum(NETWORKS)
});

type Stats = {
  itoDeposits: List<TranchesDeposit>;
  zvtDeposits: List<TranchesDeposit>;
  tranchesHolders: List<TranchesHolder>;
  stakedTranchesHolders: List<TranchesHolder>;
  zvltHolders: List<TokenHolder>;
  zvltDeposits: List<ZvltDeposit>;
};

type List<T> = {
  count: number;
  items: Array<T>;
};

const handler = async (req: NextRequest): ApiResponse<Stats> => {
  // Validate API key
  const apiKey = req.headers.get('X-API-Key');

  if (!apiKey) {
    throw new ApiError({ message: 'X-API-Key header is required', status: 401, capture: false });
  }

  if (apiKey !== env.ZIVOE_API_KEY) {
    throw new ApiError({ message: 'Invalid API key', status: 403, capture: false });
  }

  // Validate network parameter
  const queryParams = {
    network: req.nextUrl.searchParams.get('network')
  };

  if (!queryParams.network) {
    throw new ApiError({ message: 'Network parameter is required', status: 400, capture: false });
  }

  const parsedQuery = querySchema.safeParse(queryParams);
  if (!parsedQuery.success) {
    throw new ApiError({ message: 'Network parameter is invalid', status: 400, capture: false });
  }

  // Initialize clients
  const { network } = parsedQuery.data;
  const web3Client = getWeb3Client(network);
  const contracts = getContracts(network);
  const ponder = getPonder(network);

  // Fetch all data in parallel
  const [
    itoDepositsRes,
    zvtDepositsRes,
    tranchesHoldersRes,
    stakedTranchesHoldersRes,
    zvltHoldersRes,
    zvltDepositsRes
  ] = await Promise.all([
    getTranchesDeposits({ client: web3Client, contracts, type: 'ITO' }),
    getTranchesDeposits({ client: web3Client, contracts, type: 'ZVT' }),
    getTranchesTokenHolders({ ponder, contracts }),
    getStakedTranchesHolders({ ponder }),
    getZVLTTokenHolders({ ponder, contracts }),
    getZVLTDeposits({ client: web3Client, contracts })
  ]);

  // Return formatted response
  return NextResponse.json({
    success: true,
    data: {
      itoDeposits: formatList(itoDepositsRes),
      zvtDeposits: formatList(zvtDepositsRes),
      tranchesHolders: formatList(tranchesHoldersRes),
      stakedTranchesHolders: formatList(stakedTranchesHoldersRes),
      zvltHolders: formatList(zvltHoldersRes),
      zvltDeposits: formatList(zvltDepositsRes)
    }
  });
};

const formatList = <T>(items: Array<T>) => {
  return {
    count: items.length,
    items
  };
};

export const GET = withErrorHandler('Error fetching stats', handler);
