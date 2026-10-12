import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  // better-auth keeps the `fetch` it found at import, before posthog-js wraps it to add the
  // session header (instrumentation-client.ts); looking it up per call sends that header too.
  fetchOptions: { customFetchImpl: (input, init) => fetch(input, init) }
});

export const { signIn, signOut, useSession } = authClient;
