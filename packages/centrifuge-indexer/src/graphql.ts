import { initGraphQLTada } from 'gql.tada';

import type { introspection } from './graphql-env';

/**
 * gql.tada bound to the pinned `schema.graphql`; documents from this `graphql()`
 * carry schema-checked result/variable types into `fetchCentrifugeIndexer`.
 */
export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    /** The indexer serializes BigInt scalars as decimal strings. */
    BigInt: string;
    JSON: unknown;
  };
}>();

export type { ResultOf, TadaDocumentNode, VariablesOf } from 'gql.tada';
