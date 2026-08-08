import { z } from 'zod';

import { getShareClassIdentity } from '../catalog';
import { CENTRIFUGE_NETWORK_FACTS, type CentrifugeNetwork } from '../config';
import { CentrifugeIndexerError, fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { navD18 } from '../units';

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
 * NAV per share class as one multi-class query — the single cached read every
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

  // TokenInstance is a per-chain entity and the environment shares one
  // indexer, so a class instantiated on several spoke chains legitimately
  // returns one row per chain — each carrying the same hub-level `token`
  // payload. Rows are corrupt only when they disagree for one address: that
  // fails closed instead of last-write-winning into a published NAV figure.
  const tokensByAddress = new Map<string, (typeof data.tokenInstances.items)[number]['token']>();

  for (const item of data.tokenInstances.items) {
    const address = item.address.toLowerCase();
    const existing = tokensByAddress.get(address);

    if (
      existing &&
      (existing.tokenPrice !== item.token.tokenPrice ||
        existing.totalIssuance !== item.token.totalIssuance ||
        existing.decimals !== item.token.decimals)
    )
      throw new CentrifugeIndexerError({
        kind: 'validation',
        message: `The indexer returned conflicting share-token rows for ${address} on ${network}.`
      });

    tokensByAddress.set(address, item.token);
  }

  return Object.fromEntries(
    identities.map((identity) => {
      const token = tokensByAddress.get(identity.shareTokenAddress.toLowerCase());
      if (!token)
        throw new CentrifugeIndexerError({
          kind: 'validation',
          message: `Share token ${identity.shareTokenAddress} is not indexed on ${network}.`
        });

      const nav = navD18({
        tokenPrice: BigInt(token.tokenPrice),
        totalIssuance: BigInt(token.totalIssuance),
        decimals: token.decimals
      });
      return [identity.key, nav.toString()];
    })
  );
}

/**
 * Sums a nav map into the book's 18-decimal USD value. Null for an empty map:
 * "no live share classes" must render as unavailable — a surface publishing
 * NAV may never read an unconfigured book as one worth $0.
 */
export function sumShareClassNavs(navs: Record<string, string>): bigint | null {
  const values = Object.values(navs);
  if (values.length === 0) return null;
  return values.reduce((sum, navString) => sum + BigInt(navString), 0n);
}
