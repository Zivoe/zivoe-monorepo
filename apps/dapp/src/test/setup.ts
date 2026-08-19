// App modules read `@/env` at import time: skip full validation before any test
// file imports app code.
process.env.SKIP_ENV_VALIDATION = '1';
process.env.NEXT_PUBLIC_CHAIN_ENV ??= 'testnet';
