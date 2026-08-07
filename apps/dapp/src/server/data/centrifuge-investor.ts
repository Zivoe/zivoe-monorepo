import 'server-only';

import { z } from 'zod';

import {
  CENTRIFUGE_NETWORK_FACTS,
  type ResultOf,
  fetchCentrifugeIndexer,
  getShareClassIdentity,
  graphql,
  listShareClassKeys
} from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

const ANY_INVESTOR_TRANSACTION_QUERY = graphql(`
  query AnyInvestorTransaction($tokenIds: [String], $poolIds: [BigInt], $accounts: [String]) {
    investorTransactions(where: { tokenId_in: $tokenIds, poolId_in: $poolIds, account_in: $accounts }, limit: 1) {
      totalCount
    }
  }
`);

const anyInvestorTransactionSchema = z.object({
  investorTransactions: z.object({ totalCount: z.number().int() })
}) satisfies z.ZodType<ResultOf<typeof ANY_INVESTOR_TRANSACTION_QUERY>>;

/**
 * True when any investor-transaction row exists across every live share class
 * for the given wallets — any lifecycle type, so holders-by-transfer are never
 * nagged, deposited-then-redeemed users stay suppressed, and an investor in
 * any Offering is never nagged to deposit into a platform they already use.
 */
export async function hasAnyInvestorTransaction({ addresses }: { addresses: Array<string> }): Promise<boolean> {
  if (addresses.length === 0) return false;

  const network = env.NEXT_PUBLIC_NETWORK;
  const identities = listShareClassKeys(network).map((key) => getShareClassIdentity({ network, key }));
  if (identities.length === 0) return false;

  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_NETWORK_FACTS[network].indexerUrl,
    query: ANY_INVESTOR_TRANSACTION_QUERY,
    variables: {
      tokenIds: identities.map((identity) => identity.scId),
      poolIds: identities.map((identity) => identity.poolId),
      accounts: addresses.map((address) => address.toLowerCase())
    },
    dataSchema: anyInvestorTransactionSchema
  });

  return data.investorTransactions.totalCount > 0;
}
