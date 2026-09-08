# Runbook: sign in to the dapp as the agent

For an AI agent (or a script) that needs an authenticated dapp session to verify a flow, and for
the human setting that up. Code: `apps/dapp/src/app/api/agent-sign-in/`, identity and session
hook in `apps/dapp/src/server/auth.ts`.

## The agent identity

- `AGENT_ACCOUNT`: email `alex+agent@zivoe.com`, name "Zivoe Agent". The mailbox is Alex's inbox.
- An ordinary user: no wallet, no KYC, no admin role. Nothing is skipped for it. The welcome
  email, the onboarding reminder, Telegram notifications and the newsletter sync fire exactly as
  for a customer, so a run through a flow can be verified from the mailbox and the notification
  chat.
- Sessions minted by the agent route last one hour and are never extended. Sessions created
  through the normal OTP flow last seven days and are never extended either.

## Local (`next dev`)

1. Run the dapp against a localhost database. The route refuses to mint when `DATABASE_URL` does
   not name `localhost`, `127.x.x.x` or `[::1]`, so a `.env` pulled from a deployment cannot create
   the agent in a deployed database.
2. Navigate to `http://localhost:3000/api/agent-sign-in`. The browser is signed in and redirected
   to `/`. No parameters, no secret.

The route exists only under `next dev`; every deployed build compiles it to dead code. Anyone on
the same network as the dev machine can also reach it, and the most they obtain is a session in
that machine's local database.

## Vercel preview deployments

One-time setup, in the Vercel project `zivoe/zivoe-dapp-v2`:

1. Give the Preview environment its own `DATABASE_URL` and `BETTER_AUTH_SECRET`, never
   production's. A session minted on a preview must be worthless in production.
2. Apply the drizzle migrations to that preview database.
3. Add `AGENT_SIGN_IN_SECRET` (32 or more random characters) as a **Sensitive** variable scoped
   to **Preview only**. Production deployments never carry it, so the route is inert there.
4. Point the Preview `TELEGRAM_*_CHAT_ID` variables at a preview group so the agent's
   notifications stay out of the team channel.
5. Redeploy; variables apply to new deployments only.

Each session:

```bash
curl -s -X POST -H "Authorization: Bearer $AGENT_SIGN_IN_SECRET" https://<preview-host>/api/agent-sign-in
# → {"url":"https://<preview-host>/api/agent-sign-in/<token>","expiresInSeconds":180}
```

Open the returned URL in the browser within three minutes, or `curl -c cookies.txt "<url>"` for
a script. The link works once. Use the same host for the link as for the POST; the session cookie
is host-only.

If the preview sits behind Vercel Deployment Protection, add the `x-vercel-protection-bypass`
header to the POST and `?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true` to
the first browser navigation.

## Production

There is no agent route in production, by decision. The agent signs in like anyone else: open
`https://app.zivoe.com/sign-in`, request a code for `alex+agent@zivoe.com`, ask Alex for the code
(it lands in his inbox), enter it.

## Verifying a run

- Emails arrive at `alex+agent@zivoe.com`: the welcome email on onboarding, the onboarding
  reminder a day after sign-up if onboarding was not completed, and so on.
- Telegram notifications go to the preview group on previews and to the team channel in
  production.
- PostHog is disabled outside production, so previews produce no analytics to check.

## Responses and what they mean

| Response                                                      | Meaning                                                                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `404` on the POST                                             | Not a preview deployment, secret missing or wrong, or the variable was added after this deployment was built. Redeploy. |
| `429` on the POST                                             | More than five link requests in a minute from one IP.                                                                   |
| Redirect to `/sign-in?error=INVALID_TOKEN` or `EXPIRED_TOKEN` | The link was already used or is older than three minutes. Request a new one.                                            |
| `500` locally, "refuses to mint against a non-local database" | `DATABASE_URL` points at a deployment. Use the local database.                                                          |
| Signed out right after the redirect                           | The redirect landed on a different host than the one that set the cookie. Use one host throughout.                      |

## Why it is shaped this way

- Two steps on previews so the long-lived secret travels in a header from a script and never
  appears in a browser URL, history or access log; the browser only ever sees a single-use,
  three-minute link.
- The minting code builds a per-request better-auth instance with the magic-link plugin. The
  plugin is never registered on the shared instance, so no deployed build exposes passwordless
  endpoints under `/api/auth`.
- Three independent gates on previews: an inlined `NEXT_PUBLIC_ENV !== 'production'` (dead code
  in production builds), runtime `VERCEL_ENV === 'preview'`, and the Preview-scoped secret
  compared in constant time. `VERCEL_AUTOMATION_BYPASS_SECRET` is deliberately not reused: it is
  project-wide and valid on production deployments.
- The one-hour cap is enforced by a `session.update.before` hook, because better-auth's own
  `getSession` would otherwise refresh any short session back to seven days on the first read.
