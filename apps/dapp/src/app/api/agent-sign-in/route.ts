import { env } from '@/env';

import { bearerToken, isAgentSignInAllowed, isPresentedSecretValid, isPreviewAgentEnvironment } from './gate';
import { checkIpLimit } from './limit';

// Sign in as the dapp's agent identity without email OTP or a social provider, so an AI
// agent reaches the signed-in product without a human in the loop. Two entry points:
//
//   GET  — local `next dev` only: one navigation, no parameters, no secret, and the
//          browser is signed in. Wrapped in a literal NODE_ENV comparison that Next fixes
//          at build time, so every deployed build compiles it to a dead branch. The gate
//          then re-checks where the request came from (./gate.ts says what each layer is
//          worth).
//   POST — Vercel preview deployments only: `Authorization: Bearer <AGENT_SIGN_IN_SECRET>`
//          answers `{ url }`, a single-use link valid for three minutes that
//          [token]/route.ts redeems. Two steps so the long-lived secret travels in a header
//          from a script and never in a browser URL. Wrapped in an inlined NEXT_PUBLIC_ENV
//          comparison (dead in production builds), then gated at runtime on VERCEL_ENV and
//          the Preview-scoped secret, and rate-limited per IP before the secret is compared.
//
// The minting module is imported only past a gate, so a request that is refused never
// loads it. Every refusal answers an empty 404; a rate-limited caller gets 429, which does
// reveal that the deployment is armed — accepted, because a script needs to tell the two
// apart, and the secret is still required either way.

export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'development') {
    const isAllowed = isAgentSignInAllowed({
      nodeEnv: process.env.NODE_ENV,
      forwardedFor: request.headers.get('x-forwarded-for'),
      fetchSite: request.headers.get('sec-fetch-site')
    });

    if (isAllowed) {
      const { signInAsAgent } = await import('./mint');
      return signInAsAgent(request);
    }
  }

  return new Response(null, { status: 404 });
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NEXT_PUBLIC_ENV !== 'production') {
    const environment = { vercel: env.VERCEL, vercelEnv: env.VERCEL_ENV, configuredSecret: env.AGENT_SIGN_IN_SECRET };

    if (isPreviewAgentEnvironment(environment)) {
      const limit = await checkIpLimit('issue', request);
      if (limit === 'limited') return new Response(null, { status: 429 });

      const presentedSecret = bearerToken(request.headers.get('authorization'));
      if (
        limit === 'ok' &&
        isPresentedSecretValid({ configuredSecret: environment.configuredSecret, presentedSecret })
      ) {
        const { LINK_TTL_SECONDS, issueAgentSignInLink } = await import('./mint');
        const url = await issueAgentSignInLink(request);

        return Response.json({ url, expiresInSeconds: LINK_TTL_SECONDS }, { headers: { 'cache-control': 'no-store' } });
      }
    }
  }

  return new Response(null, { status: 404 });
}
