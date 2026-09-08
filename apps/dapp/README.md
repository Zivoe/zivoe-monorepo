## Zivoe dApp

### Agent sign-in

An AI agent (or any script) can sign in as the dapp's own agent identity (`AGENT_ACCOUNT` in
`src/server/auth.ts`, mailbox `alex+agent@zivoe.com`) without email OTP or a social provider.
The agent is an ordinary user with no wallet, no KYC and no admin role, and nothing is skipped
for it: the welcome email, reminders and Telegram notifications fire exactly as for a customer,
so a run through onboarding can be verified from that mailbox and the notification chat. Point
the Preview environment's `TELEGRAM_*_CHAT_ID` variables at a preview group so those pings stay
out of the team channel.

**Locally** (`next dev` against a localhost database): navigate to
`http://localhost:3000/api/agent-sign-in`. The route is dead code in every deployed build and
refuses to mint against a non-local `DATABASE_URL`.

**On a Vercel preview deployment**

1. One-time setup. Give the Preview environment its own `DATABASE_URL` and `BETTER_AUTH_SECRET`,
   never production's: a session minted on a preview must be worthless in production. Then add
   `AGENT_SIGN_IN_SECRET` (32+ random characters) as a **Sensitive** variable scoped to
   **Preview only**. Production deployments never carry it, so the route is inert there.
2. Issue a link. The secret travels in a header, never in a URL:

   ```bash
   curl -s -X POST -H "Authorization: Bearer $AGENT_SIGN_IN_SECRET" https://<preview-host>/api/agent-sign-in
   # → {"url":"https://<preview-host>/api/agent-sign-in/<token>","expiresInSeconds":180}
   ```

3. Open the URL in the browser (or `curl -c cookies.txt "<url>"`). The link works once and expires
   after three minutes; the session lasts one hour and is not extended.

If the preview sits behind Vercel Deployment Protection, add the `x-vercel-protection-bypass`
header to the POST and `?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true`
to the first browser navigation.

A wrong or missing secret, a non-preview environment, or a used or expired link all answer 404
(an expired link redirects to `/sign-in` with an error toast). Issuing is rate-limited to five
requests per minute per IP.

Production has no agent route. To verify production, the agent signs in like anyone else:
request an OTP for the agent mailbox and enter the code.
