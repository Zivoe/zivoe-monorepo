import { env } from '@/env';

import { ALLOWED_FETCH_SITES, isPreviewAgentEnvironment } from '../gate';

// Step two of the preview agent sign-in: redeem a link issued by the POST in ../route.ts.
// The token is the credential — single use, three minutes, hashed at rest — so no secret
// is presented and the request can be a plain browser navigation. Same inlined
// NEXT_PUBLIC_ENV kill switch and runtime environment gate as issuing; the Sec-Fetch-Site
// allowlist keeps a cross-site page from navigating a browser onto an agent session with
// a leaked link. A bad or expired token is answered by the plugin with a redirect to
// /sign-in?error=…, which the sign-in page shows as a toast.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  if (process.env.NEXT_PUBLIC_ENV !== 'production') {
    const isAllowed =
      isPreviewAgentEnvironment({
        vercel: env.VERCEL,
        vercelEnv: env.VERCEL_ENV,
        configuredSecret: env.AGENT_SIGN_IN_SECRET
      }) && ALLOWED_FETCH_SITES.has(request.headers.get('sec-fetch-site'));

    if (isAllowed) {
      const { token } = await params;
      const { redeemAgentSignInLink } = await import('../mint');
      return redeemAgentSignInLink(request, token);
    }
  }

  return new Response(null, { status: 404 });
}
