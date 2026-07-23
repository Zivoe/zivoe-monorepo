import { print } from '@0no-co/graphql.web';
import { type z } from 'zod';

import { type TadaDocumentNode } from './graphql';

export type CentrifugeIndexerErrorKind = 'network' | 'http' | 'graphql' | 'validation';

/**
 * A hung indexer must not stall render paths (hero / stats stream behind this
 * fetch); callers can pass their own `fetchOptions.signal` to override.
 */
const DEFAULT_TIMEOUT_MS = 10_000;

export class CentrifugeIndexerError extends Error {
  public readonly kind: CentrifugeIndexerErrorKind;
  public readonly status?: number;

  constructor({ kind, message, status }: { kind: CentrifugeIndexerErrorKind; message: string; status?: number }) {
    super(message);
    this.name = 'CentrifugeIndexerError';
    this.kind = kind;
    this.status = status;
  }
}

export async function fetchCentrifugeIndexer<TData, TResult, TVariables>({
  indexerUrl,
  query,
  variables,
  dataSchema,
  fetchOptions
}: {
  indexerUrl: string;
  /** A document from this package's `graphql()` — type-checked against the pinned schema. */
  query: TadaDocumentNode<TResult, TVariables>;
  variables?: TVariables;
  /**
   * The runtime trust boundary — keep aligned with the document via
   * `satisfies z.ZodType<ResultOf<typeof QUERY>>`; zod may be stricter than
   * schema nullability.
   */
  dataSchema: z.ZodType<TData>;
  fetchOptions?: RequestInit;
}): Promise<TData> {
  const response = await fetch(indexerUrl, {
    ...fetchOptions,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...fetchOptions?.headers },
    body: JSON.stringify({ query: print(query), variables }),
    signal: fetchOptions?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  }).catch((error: unknown) => {
    throw new CentrifugeIndexerError({
      kind: 'network',
      message: `Centrifuge indexer request failed to send: ${error instanceof Error ? error.message : 'unknown error'}.`
    });
  });

  if (!response.ok)
    throw new CentrifugeIndexerError({
      kind: 'http',
      status: response.status,
      message: `Centrifuge indexer request failed with status ${response.status}.`
    });

  let body: { data?: unknown; errors?: Array<{ message?: string }> };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new CentrifugeIndexerError({
      kind: 'validation',
      message: 'Centrifuge indexer returned a non-JSON response.'
    });
  }

  if (body.errors && body.errors.length > 0)
    throw new CentrifugeIndexerError({
      kind: 'graphql',
      message: `Centrifuge indexer returned GraphQL errors: ${body.errors.map((error) => error.message ?? 'unknown').join('; ')}`
    });

  const parsed = dataSchema.safeParse(body.data);
  if (!parsed.success)
    throw new CentrifugeIndexerError({
      kind: 'validation',
      message: `Centrifuge indexer returned an unexpected response shape: ${parsed.error.message}`
    });

  return parsed.data;
}
