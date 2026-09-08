# Runbook: sign in to the dapp as the agent

For an AI agent (or a script) that needs an authenticated dapp session to verify a flow, and for
the human setting that up. Code: `apps/dapp/src/app/api/agent-sign-in/`, identity in
`packages/database/src/agent.ts`, session hook in `apps/dapp/src/server/auth.ts`.

## The agent identity

- `AGENT_ACCOUNT`: email `alex+agent@zivoe.com`, name "Zivoe Agent". The mailbox is Alex's inbox.
- An ordinary user: no wallet, no KYC, no admin role. Nothing is skipped for it. The welcome
  email, the onboarding reminder and Telegram notifications fire exactly as for a customer, so a
  run through a flow can be verified from the mailbox and the notification chat. The newsletter
  subscription and PostHog only run in production, for every user.
- Sessions minted by the agent route last one hour and are never extended. Normal sessions last
  seven days and slide back to seven on use once a day old; the hook exempts only the agent.

## Never

- Never add `AGENT_SIGN_IN_SECRET` to the Production environment, or to "All environments".
- Never paste an issued link into a chat or a document: link previews fetch it and burn it.
- Never reuse `VERCEL_AUTOMATION_BYPASS_SECRET` as the agent secret. It is project-wide and valid
  on production deployments.

## Local (`next dev`)

Needs a Postgres reachable from the laptop and `DATABASE_URL` pointing at it. The route mints
against whatever database that is, so check the host before a run. Any local Postgres works, for
example:

```bash
docker run -d --name zivoe-pg -p 5433:5432 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=zivoe postgres:17
```

1. Apply the migrations and seed the agent, already onboarded:

   ```bash
   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/zivoe pnpm --filter @zivoe/database db:migrate
   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/zivoe pnpm --filter @zivoe/database db:seed
   ```

   Without an explicit `DATABASE_URL` both commands read `packages/database/.env`. To test
   onboarding itself, `db:seed -- --fresh` deletes the agent and the next sign-in recreates it.

2. Start the dapp with the same `DATABASE_URL` and type `http://localhost:3000/api/agent-sign-in`
   into the address bar (or `curl -c cookies.txt` it). The browser is signed in and redirected to
   `/`. No parameters, no secret. A link clicked from another page (a chat, another localhost
   port) is refused with 404 by the `Sec-Fetch-Site` check.

The route exists only under `next dev`; every deployed build compiles it to dead code. Anyone on
the same network as the dev machine can also reach it, and what they obtain is a one-hour agent
session in the database the dev server points at.

## Vercel preview deployments

One-time setup, in the Vercel project `zivoe/zivoe-dapp-v2`:

1. Give the Preview environment its own `DATABASE_URL` and `BETTER_AUTH_SECRET`, never
   production's. **Without this, a session minted on a preview is a production session, and the
   code cannot detect it.** Confirm the hosts differ in the database provider's dashboard; the
   Vercel UI cannot show Sensitive values.
2. Apply the migrations to that preview database, then optionally seed the agent:
   `DATABASE_URL=<preview url> pnpm --filter @zivoe/database db:migrate` (and `db:seed`).
3. Point the Preview `TELEGRAM_*_CHAT_ID` variables at a preview group so the agent's
   notifications stay out of the team channel.
4. Last, add `AGENT_SIGN_IN_SECRET` as a **Sensitive** variable scoped to **Preview only**:
   `openssl rand -hex 32`. No whitespace. A value shorter than 32 characters fails env validation
   and takes the whole deployment down, not just the route. Production never carries it, so the
   route is inert there.
5. Redeploy; variables apply to new deployments only.

Each session:

```bash
curl -s -X POST -H "Authorization: Bearer $AGENT_SIGN_IN_SECRET" https://<preview-host>/api/agent-sign-in
# → {"url":"https://<preview-host>/api/agent-sign-in/<token>","expiresInSeconds":180}
```

Paste the returned URL into the address bar within three minutes, or `curl -c cookies.txt "<url>"`
for a script. The link works once. Use the same host for the link as for the POST; the session
cookie is host-only.

If the preview sits behind Vercel Deployment Protection, send `x-vercel-protection-bypass` as a
header on the POST. A browser cannot set headers, so the first navigation needs
`?x-vercel-protection-bypass=<secret>&x-vercel-set-bypass-cookie=true`, which puts a project-wide
secret in history and logs: prefer a header-capable client, or a preview without protection.

## Production

There is no agent route in production, by decision. The agent signs in like anyone else: open
`https://app.zivoe.com/sign-in`, request a code for `alex+agent@zivoe.com`, ask Alex for the code
(it lands in his inbox), enter it.

## Verifying a run

- Emails arrive at `alex+agent@zivoe.com`: the welcome email on onboarding, the onboarding
  reminder a day after sign-up if onboarding was not completed, and so on. These, and the
  Telegram pings, are QStash callbacks to the deployment URL: behind Deployment Protection they
  get 401 and never arrive.
- Telegram notifications go to the preview group on previews and to the team channel in
  production.
- PostHog and the newsletter subscription are disabled outside production.

## Responses and what they mean

| Response                                                      | Meaning                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `404` on the local GET                                        | Not `next dev`, the request did not arrive from loopback, or it was a link clicked from another page. Type the URL into the address bar.                            |
| `404` on the POST                                             | Not a preview deployment, secret missing or wrong, the variable was added after this deployment was built, or Redis could not answer the rate limit. Redeploy.      |
| `404` on the link                                             | Same environment checks as the POST, a link clicked from another page, a token of the wrong shape, or Redis could not answer the rate limit.                        |
| `429`                                                         | More than five requests in a minute from one IP, per step.                                                                                                          |
| Redirect to `/sign-in?error=INVALID_TOKEN` or `EXPIRED_TOKEN` | The link was already used or is older than three minutes. Request a new one. In a browser this shows only as a "Sign In Failed" toast; the code is in the redirect. |
| Signed out right after the redirect                           | The redirect landed on a different host than the one that set the cookie. Use one host throughout.                                                                  |

## Why it is shaped this way

Two steps on previews so the long-lived secret travels in a header and the browser only ever sees a
single-use link. A per-request better-auth instance carries the magic-link plugin, so no deployed
build exposes passwordless endpoints under `/api/auth`. Three independent gates on previews: an
inlined `NEXT_PUBLIC_ENV !== 'production'`, runtime `VERCEL_ENV === 'preview'`, and the
Preview-scoped secret compared in constant time. The header comments in `gate.ts` and `mint.ts`
say what each layer is worth.
