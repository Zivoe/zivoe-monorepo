import { isAgentSignInAllowed } from './gate';

// Sign in as the dapp's agent identity without email OTP or a social provider, so an AI
// agent reaches the signed-in product without a human in the loop: one navigation, no
// parameters, no secret, and the browser is signed in.
//
// Development only. The literal NODE_ENV comparison is the enclosing `if` because Next
// fixes NODE_ENV at build time, so every deployed build compiles it to a dead branch and
// never imports the minting module. The gate then re-checks where the request came from
// (./gate.ts says what each layer is worth). Every refusal answers an empty 404.
export async function GET(request: Request): Promise<Response> {
  if (process.env.NODE_ENV === 'development') {
    const isAllowed = isAgentSignInAllowed({
      nodeEnv: process.env.NODE_ENV,
      forwardedFor: request.headers.get('x-forwarded-for'),
      fetchSite: request.headers.get('sec-fetch-site')
    });

    if (isAllowed) {
      // Loaded only past the gate, so a process that never passes it never holds a module
      // that can mint.
      const { signInAsAgent } = await import('./mint');
      return signInAsAgent(request);
    }
  }

  return new Response(null, { status: 404 });
}
