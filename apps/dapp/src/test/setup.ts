import { afterEach } from 'vitest';

// App modules read `@/env` at import time: skip full validation before any test
// file imports app code.
process.env.SKIP_ENV_VALIDATION = '1';
process.env.NEXT_PUBLIC_CHAIN_ENV ??= 'testnet';

// jsdom's localStorage outlives each test in a file, and persisted atoms sync
// it back in on mount — clear it so no test inherits another's selections.
// (Guarded: node-environment suites have no localStorage.)
afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
