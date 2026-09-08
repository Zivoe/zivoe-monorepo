import 'server-only';

import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';

import { AGENT_ACCOUNT, authOptions } from '@/server/auth';

import { env } from '@/env';

import { isLocalDatabase, toOriginRelative } from './gate';

// Mint a session for AGENT_ACCOUNT without email or OAuth, for the development-only agent
// sign-in route (./route.ts). Only ever imported after a request passes the gate in ./gate.ts.
//
// Every call builds a fresh better-auth instance from the dapp's own authOptions — same
// secret, same tables, same hooks — plus the magic-link plugin, with the link captured in
// process instead of emailed. Both halves of the flow are the plugin's own endpoints, so
// the minted cookie is indistinguishable from a real sign-in's. The plugin lives only
// here, never on the shared instance, so no deployed build exposes passwordless endpoints
// under /api/auth. Tokens are stored hashed in the verification table and deleted on first
// use.
//
// `baseURL` is deliberately not overridden to the request origin: better-auth derives the
// cookie name from its protocol (`__Secure-` prefix or none), so an instance disagreeing
// with the dapp's own would mint a cookie the app cannot see. The redirect is corrected
// instead (toOriginRelative).

// A fresh instance per call keeps the captured token request-scoped and leaves no
// long-lived object that can mint sessions.
function createAgentAuth(onToken: (token: string) => void) {
  return betterAuth({
    ...authOptions,
    session: {
      ...authOptions.session,
      // The cache cookie is the one artefact better-auth trusts without reading the
      // session row; without it the cookie set here is a bare session token. The dapp's
      // own instance repopulates the cache on the next request.
      cookieCache: { enabled: false }
    },
    plugins: [
      // First so nextCookies stays last, which the vendor requires.
      magicLink({ storeToken: 'hashed', sendMagicLink: ({ token }) => onToken(token) }),
      ...authOptions.plugins
    ]
  });
}

// Passing the request headers through gives the rows the same IP and user-agent a real
// sign-in records.
async function issueAgentToken(request: Request) {
  let token: string | undefined;
  const agentAuth = createAgentAuth((issued) => {
    token = issued;
  });

  await agentAuth.api.signInMagicLink({
    body: { email: AGENT_ACCOUNT.email, name: AGENT_ACCOUNT.name },
    headers: request.headers
  });

  if (!token) throw new Error('Agent sign-in issued no magic-link token; the magic-link plugin did not run.');
  return token;
}

// Verify consumes the token: find-or-create the agent user (running the same database
// hooks a real sign-in runs), create the session, set the cookie, redirect to `/`. A bad
// or expired token redirects to /sign-in?error=…, which the sign-in page shows as a toast.
async function redeemAgentToken(request: Request, token: string) {
  const agentAuth = createAgentAuth(() => undefined);

  const response = await agentAuth.api.magicLinkVerify({
    query: { token, callbackURL: '/', errorCallbackURL: '/sign-in' },
    headers: request.headers,
    asResponse: true
  });

  const location = response.headers.get('location');
  if (location) response.headers.set('location', toOriginRelative(location, request.url));

  return response;
}

/** Sign the request's browser in as the agent within this one request. */
export async function signInAsAgent(request: Request): Promise<Response> {
  // Asked before anything touches the database, because issuing the token writes a row.
  if (!isLocalDatabase(env.DATABASE_URL)) {
    return new Response(
      'Agent sign-in refuses to mint a session against a non-local database. This DATABASE_URL does not name localhost, which usually means the environment was pulled from a deployment. Fix: point DATABASE_URL at your local database, or sign in through the normal flow.',
      { status: 500, headers: { 'content-type': 'text/plain' } }
    );
  }

  const token = await issueAgentToken(request);
  return redeemAgentToken(request, token);
}
