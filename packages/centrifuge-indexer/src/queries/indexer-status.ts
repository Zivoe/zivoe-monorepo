import { z } from 'zod';

import { CENTRIFUGE_ENVIRONMENT_FACTS, type CentrifugeEnvironment } from '../config';
import { fetchCentrifugeIndexer } from '../fetch';
import { graphql } from '../graphql';

const INDEXER_STATUS_QUERY = graphql(`
  query IndexerStatus {
    _meta {
      status
    }
  }
`);

// Unlike the sibling queries this cannot carry `satisfies
// z.ZodType<ResultOf<…>>`: zod infers a ZodUnknown object key as optional,
// which can never satisfy the document's required-but-unknown JSON `status`.
// The runtime boundary is unchanged — `status` is re-validated entry-by-entry
// below.
const dataSchema = z.object({
  _meta: z.object({ status: z.unknown() }).nullable()
});

/**
 * `_meta.status` is an untyped JSON scalar keyed by the indexer's internal
 * chain names; entries carry the numeric chain id, which is the stable key we
 * match on. Parsed entry-by-entry so one malformed chain never hides the rest.
 */
const chainStatusSchema = z.object({
  id: z.number().int(),
  block: z.object({ number: z.number().int(), timestamp: z.number().int() })
});

export type IndexerChainStatus = {
  /** Last block the indexer has ingested for the chain — carried for operator debugging of stalls. */
  blockNumber: number;
  /** That block's timestamp, epoch milliseconds — the freshness signal. */
  lastIndexedAtMs: number;
};

/**
 * How far the environment's indexer has ingested each chain it serves, keyed
 * by numeric chain id — the staleness probe for alerting passes. A chain
 * absent from the map must read as stale, never as fresh: a missing entry is
 * exactly what a stalled or re-syncing instance looks like.
 */
export async function fetchIndexerChainStatuses({
  environment,
  fetchOptions
}: {
  environment: CentrifugeEnvironment;
  fetchOptions?: RequestInit;
}): Promise<Map<number, IndexerChainStatus>> {
  const data = await fetchCentrifugeIndexer({
    indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[environment].indexerUrl,
    query: INDEXER_STATUS_QUERY,
    variables: {},
    dataSchema,
    fetchOptions
  });

  const statuses = new Map<number, IndexerChainStatus>();
  const status = data._meta?.status;
  if (typeof status !== 'object' || status === null) return statuses;

  for (const entry of Object.values(status)) {
    const parsed = chainStatusSchema.safeParse(entry);
    if (!parsed.success) continue;

    statuses.set(parsed.data.id, {
      blockNumber: parsed.data.block.number,
      lastIndexedAtMs: parsed.data.block.timestamp * 1000
    });
  }

  return statuses;
}
