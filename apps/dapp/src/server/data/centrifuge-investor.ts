import 'server-only';

import { z } from 'zod';

import {
  CENTRIFUGE_NETWORK_FACTS,
  type ResultOf,
  fetchCentrifugeIndexer,
  getShareClassIdentity,
  graphql
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
 * any Zivoe Vault is never nagged to deposit into a platform they already use.
 */
export async function hasAnyInvestorTransaction({
  shareClassKeys,
  addresses
}: {
  /** The live book, resolved AND guarded by the caller — an empty book cannot answer this question. */
  shareClassKeys: Array<string>;
  addresses: Array<string>;
}): Promise<boolean> {
  if (addresses.length === 0) return false;

  const network = env.NEXT_PUBLIC_NETWORK;
  const identities = shareClassKeys.map((key) => getShareClassIdentity({ network, key }));

  // Defense in depth behind the parameter: `false` would read as "never
  // invested" and re-arm every nag downstream.
  if (identities.length === 0)
    throw new Error(`No live share class on "${network}" — investor activity is unknowable, not absent.`);

  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_NETWORK_FACTS[network].indexerUrl,
    query: ANY_INVESTOR_TRANSACTION_QUERY,
    variables: {
      tokenIds: identities.map((identity) => identity.scId),
      // Deduped: share classes of one pool share a poolId (both current
      // classes do), and the duplicate reads like a bug at the query layer.
      poolIds: [...new Set(identities.map((identity) => identity.poolId))],
      accounts: addresses.map((address) => address.toLowerCase())
    },
    dataSchema: anyInvestorTransactionSchema
  });

  return data.investorTransactions.totalCount > 0;
}
