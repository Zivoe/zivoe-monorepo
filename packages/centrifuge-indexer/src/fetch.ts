import { print } from '@0no-co/graphql.web';
import { type z } from 'zod';

import { type TadaDocumentNode } from './graphql';

export type CentrifugeIndexerErrorKind = 'network' | 'http' | 'graphql' | 'validation';

/**
 * A hung indexer must not stall render paths (hero / stats stream behind this
 * fetch); callers can pass their own `fetchOptions.signal` to override.
 */
const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 250;

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

type FetchCentrifugeIndexerOptions<TData, TResult, TVariables> = {
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
};

/** Retry one transient read failure within the original request's time budget. */
export async function fetchCentrifugeIndexer<TData, TResult, TVariables>(
  options: FetchCentrifugeIndexerOptions<TData, TResult, TVariables>
): Promise<TData> {
  const signal = options.fetchOptions?.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  const request = { ...options, fetchOptions: { ...options.fetchOptions, signal } };
  try {
    return await fetchCentrifugeIndexerOnce(request);
  } catch (error) {
    const retryable =
      error instanceof CentrifugeIndexerError &&
      (error.kind === 'network' ||
        (error.kind === 'http' &&
          error.status !== undefined &&
          ([408, 425, 429].includes(error.status) || (error.status >= 500 && error.status < 600))));
    if (!retryable || signal.aborted) throw error;

    const shouldRetry = await new Promise<boolean>((resolve) => {
      const abort = () => {
        clearTimeout(timer);
        resolve(false);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve(true);
      }, RETRY_DELAY_MS);
      signal.addEventListener('abort', abort, { once: true });
    });
    if (!shouldRetry || signal.aborted) throw error;
    return fetchCentrifugeIndexerOnce(request);
  }
}

async function fetchCentrifugeIndexerOnce<TData, TResult, TVariables>({
  indexerUrl,
  query,
  variables,
  dataSchema,
  fetchOptions
}: FetchCentrifugeIndexerOptions<TData, TResult, TVariables>): Promise<TData> {
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
  } catch (error) {
    // The timeout signal also aborts a hung body read (headers arrived, body
    // stalled) — surface that as the network timeout it is, not as malformed JSON.
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError'))
      throw new CentrifugeIndexerError({
        kind: 'network',
        message: `Centrifuge indexer response body read ${error.name === 'TimeoutError' ? 'timed out' : 'was aborted'}.`
      });
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
