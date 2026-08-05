import 'server-only';

import { z } from 'zod';

import { type ResultOf, fetchCentrifugeIndexer, getCentrifugeIndexerConfig, graphql } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

const ANY_INVESTOR_TRANSACTION_QUERY = graphql(`
  query AnyInvestorTransaction($tokenId: String!, $poolId: BigInt!, $accounts: [String]) {
    investorTransactions(where: { tokenId: $tokenId, poolId: $poolId, account_in: $accounts }, limit: 1) {
      totalCount
    }
  }
`);

const anyInvestorTransactionSchema = z.object({
  investorTransactions: z.object({ totalCount: z.number().int() })
}) satisfies z.ZodType<ResultOf<typeof ANY_INVESTOR_TRANSACTION_QUERY>>;

/**
 * True when any investor-transaction row exists for our pool across the given
 * wallets — any lifecycle type, so holders-by-transfer are never nagged and
 * deposited-then-redeemed users stay suppressed.
 */
export async function hasAnyInvestorTransaction({ addresses }: { addresses: Array<string> }): Promise<boolean> {
  if (addresses.length === 0) return false;

  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);

  const data = await fetchCentrifugeIndexer({
    indexerUrl: config.indexerUrl,
    query: ANY_INVESTOR_TRANSACTION_QUERY,
    variables: {
      tokenId: config.scId,
      poolId: config.poolId,
      accounts: addresses.map((address) => address.toLowerCase())
    },
    dataSchema: anyInvestorTransactionSchema
  });

  return data.investorTransactions.totalCount > 0;
}
