import { z } from 'zod';

import { getShareClassIdentity } from '../catalog';
import { CENTRIFUGE_NETWORK_FACTS, type CentrifugeNetwork } from '../config';
import { CentrifugeIndexerError, fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';

const SHARE_CLASS_NAVS_QUERY = graphql(`
  query ShareClassNavs($shareTokenAddresses: [String]) {
    tokenInstances(where: { address_in: $shareTokenAddresses }) {
      items {
        address
        token {
          tokenPrice
          totalIssuance
          decimals
        }
      }
    }
  }
`);

const integerString = z.string().regex(/^\d+$/);
const positiveIntegerString = z.string().regex(/^\d*[1-9]\d*$/);

// Stricter than the schema's nullability on purpose: one unpriced class fails
// the whole read — consumers hide the aggregate instead of rendering a
// partial sum.
const dataSchema = z.object({
  tokenInstances: z.object({
    items: z.array(
      z.object({
        address: z.string(),
        token: z.object({
          tokenPrice: positiveIntegerString,
          totalIssuance: integerString,
          decimals: z.number().int().nonnegative()
        })
      })
    )
  })
}) satisfies z.ZodType<ResultOf<typeof SHARE_CLASS_NAVS_QUERY>>;

/**
 * AUM per share class as one multi-class query — the single cached read every
 * aggregated surface derives from. Returns a map keyed by share-class id with
 * 18-decimal USD values as decimal strings (JSON-plain for cache layers).
 * Fail-closed by design: a class the indexer cannot price fails the whole
 * read, so a partial book can never render as the whole one.
 */
export async function fetchShareClassNavs({
  network,
  shareClassKeys,
  fetchOptions
}: {
  network: CentrifugeNetwork;
  shareClassKeys: Array<string>;
  fetchOptions?: RequestInit;
}): Promise<Record<string, string>> {
  if (shareClassKeys.length === 0) return {};

  const identities = shareClassKeys.map((key) => getShareClassIdentity({ network, key }));

  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_NETWORK_FACTS[network].indexerUrl,
    query: SHARE_CLASS_NAVS_QUERY,
    variables: { shareTokenAddresses: identities.map((identity) => identity.shareTokenAddress.toLowerCase()) },
    dataSchema,
    fetchOptions
  });

  const tokensByAddress = new Map(data.tokenInstances.items.map((item) => [item.address.toLowerCase(), item.token]));

  return Object.fromEntries(
    identities.map((identity) => {
      const token = tokensByAddress.get(identity.shareTokenAddress.toLowerCase());
      if (!token)
        throw new CentrifugeIndexerError({
          kind: 'validation',
          message: `Share token ${identity.shareTokenAddress} is not indexed on ${network}.`
        });

      const nav = (BigInt(token.tokenPrice) * BigInt(token.totalIssuance)) / 10n ** BigInt(token.decimals);
      return [identity.key, nav.toString()];
    })
  );
}

/**
 * Sums a nav map into the book's 18-decimal USD value. Null for an empty map:
 * "no live share classes" must render as unavailable — a surface publishing
 * AUM may never read an unconfigured book as one worth $0.
 */
export function sumShareClassNavs(navs: Record<string, string>): bigint | null {
  const values = Object.values(navs);
  if (values.length === 0) return null;
  return values.reduce((sum, navD18) => sum + BigInt(navD18), 0n);
}
