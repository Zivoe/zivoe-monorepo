import { type CentrifugeIndexerError } from '../fetch';

/**
 * Collapses per-chain TokenInstance rows onto their one hub-level payload.
 * TokenInstance is a per-chain entity and the environment shares one indexer,
 * so a class instantiated on several spoke chains legitimately returns one
 * row per chain, each carrying the same hub-level `token` payload. Rows are
 * corrupt only when they disagree — that fails closed (`conflictError`)
 * instead of an arbitrary row winning into a published figure. Every field of
 * the payload is compared, so a field added to a query is guarded without
 * touching this check. Returns undefined for no rows — "not indexed" wording
 * is the caller's.
 */
export function requireAgreeingTokenRows<T extends Record<string, string | number | null>>({
  rows,
  conflictError
}: {
  rows: Array<T>;
  conflictError: () => CentrifugeIndexerError;
}): T | undefined {
  const [first, ...rest] = rows;
  if (!first) return undefined;

  for (const row of rest) {
    for (const field of Object.keys(first)) {
      if (row[field] !== first[field]) throw conflictError();
    }
  }

  return first;
}
