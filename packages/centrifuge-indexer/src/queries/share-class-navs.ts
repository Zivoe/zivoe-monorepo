import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../chains';
import { CentrifugeIndexerError, fetchCentrifugeIndexer } from '../fetch';
import { type ResultOf, graphql } from '../graphql';
import { getShareClassIdentity } from '../share-classes';
import { navD18 } from '../units';
import { requireAgreeingTokenRows } from './token-rows';

// Filtered by tokenId (the hub-level share-class id), not by token address:
// addresses are per-chain facts, and NAV is a hub-level figure that must not
// depend on which chains the class happens to be instantiated on.
const SHARE_CLASS_NAVS_QUERY = graphql(`
  query ShareClassNavs($tokenIds: [String]) {
    tokenInstances(where: { tokenId_in: $tokenIds }) {
      items {
        tokenId
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
        tokenId: z.string(),
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
  environment,
  shareClassKeys,
  fetchOptions
}: {
  environment: CentrifugeEnvironment;
  shareClassKeys: Array<string>;
  fetchOptions?: RequestInit;
}): Promise<Record<string, string>> {
  if (shareClassKeys.length === 0) return {};

  const identities = shareClassKeys.map((key) => getShareClassIdentity({ environment, key }));

  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
    query: SHARE_CLASS_NAVS_QUERY,
    variables: { tokenIds: identities.map((identity) => identity.scId) },
    dataSchema,
    fetchOptions
  });

  const rowsByScId = new Map<string, Array<(typeof data.tokenInstances.items)[number]['token']>>();
  for (const item of data.tokenInstances.items) {
    const rows = rowsByScId.get(item.tokenId) ?? [];
    rows.push(item.token);
    rowsByScId.set(item.tokenId, rows);
  }

  return Object.fromEntries(
    identities.map((identity) => {
      const token = requireAgreeingTokenRows({
        rows: rowsByScId.get(identity.scId) ?? [],
        conflictError: () =>
          new CentrifugeIndexerError({
            kind: 'validation',
            message: `The indexer returned conflicting share-token rows for ${identity.scId} on ${environment}.`
          })
      });
      if (!token)
        throw new CentrifugeIndexerError({
          kind: 'validation',
          message: `Share class "${identity.key}" is not indexed on ${environment}.`
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
