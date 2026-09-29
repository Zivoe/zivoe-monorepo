# Zivoe Alternative Credit prototype

Zivoe Alternative Credit is an internal/partner review prototype at `/vaults/perena-usdc-demo`. Its card appears in the
Vaults grid at `/` (`/vaults` redirects there). It is separate from the real vault registry.

## Enable for review

- Use the working checkout `/Users/pseudonaut/code/zivoe-monorepo` on branch `feat/mock-perena`.
  The reviewed UI is committed in `95197fc7`; keep the prototype source, tests, documentation,
  and orange Alternative Credit logo in this checkout.
- In the ignored `apps/dapp/.env.development.local`, set `PERENA_DEMO_ENABLED=true` and retain
  `NEXT_PUBLIC_ENV=development`. The demo flag defaults to `false` when absent.
- In Vercel project `zivoe/zivoe-dapp-v2`, explicitly set both `PERENA_DEMO_ENABLED=true` and
  `NEXT_PUBLIC_ENV=development` for **Preview**, scoped to Git branch **`feat/mock-perena`**.
  Leave variables in all other scopes and existing Deployment Protection unchanged.
- Environment changes apply to **new deployments only**, not existing deployments
  ([Vercel documentation](https://vercel.com/docs/environment-variables)). A future Preview
  deployment is user-triggered through the GitHub PR workflow. After that deployment is ready,
  use a fresh navigation or reload `/` before checking the grid; an already-open page may be stale.
- Production is rejected even when the flag is set: `VERCEL_ENV=production` or
  `NEXT_PUBLIC_ENV=production` blocks access.
  A non-Vercel production build is also blocked. Never publish this prototype to production.
- The proxy rejects disabled/production requests with HTTP 404 before any layout can stream;
  the dynamic route also checks the environment. The grid's demo card is
  rendered behind a request-time check so preview visibility is not baked into the static shell.
- Sign in and complete onboarding as usual. For agent testing, follow [agent sign-in](agent-sign-in.md)
  with a separate local/preview database. The demo does not bypass either step.

For local verification, start `pnpm --filter zivoe-dapp dev` from this checkout with an explicit
`DATABASE_URL` pointing to the isolated local database prepared by the agent sign-in runbook.
Do not rely on a downloaded environment file's database URL. Navigate directly to
`http://localhost:3000/api/agent-sign-in` to authenticate the seeded, onboarded agent.
If port 3000 is occupied, pass `--port 3002` to the dev command and use that port in the sign-in
and showcase URLs. Set `APP_URL=http://localhost:3002` for that local run.

Showcase paths:

- `/vaults/perena-usdc-demo`
- `/vaults/perena-usdc-demo?view=deposit`
- `/vaults/perena-usdc-demo?view=redeem`

On mobile the deposit and redeem deep links open the transaction dialog.
On desktop the sticky transaction panel sits on the right, matching the existing vault page.
The global wallet action becomes a Demo indicator on this route.

The page follows the zSMB layout: a sample NAV/Token Price chart, unboxed metrics, three
proposed/demo highlights, expandable About, Details, Documents, Contact Us, and local activity.
The Earn panel shows amount and exact 1:1 estimated receive before connecting. Its footer holds
demo USDC, share balance, position value, and Reset demo. Mobile uses the bottom action bar and
a scrollable Earn dialog with one title.

## Simulation rules

- Start with 1,000 demo USDC and zero ordinary, untranched shares.
- Share price is fixed at $1.00, simulated fees are zero, and balances use six-decimal BigInt units.
- Deposit mints simulated shares; redeem burns them and returns simulated USDC immediately.
- 6% APY, $250,000 NAV, and the chart are labeled sample data, not Perena terms or performance.
  There is no yield accrual, and simulated deposits do not affect the chart or the real grid NAV.
- Enter an amount (optional) → Use demo wallet → review → simulate transaction → processing → success.
  Cancel is available before confirmation. Confirmation/completion are guarded by reducer state
  and transaction ID; duplicates cannot change balances twice.
- Balances, demo wallet connection, and up to 50 local activity entries persist in the current
  tab's `sessionStorage` key `zivoe:prototype:perena-usdc:v1`. Unconfirmed/interrupted transactions
  do not settle on reload. Malformed or incompatible storage restores the starting fixture.
- Reset demo restores the starting fixture and clears local activity. If storage is blocked,
  the demo remains usable and explains that reloading will reset it.

All actions are handled by `src/prototypes/perena` with a local reducer and timer. They import
no wallet SDK, signing/approval hooks, transaction/receipt services, or portfolio actions.
There is no backend endpoint, migration, token mint, or live Perena integration.

Reference links: [Perena Vault V2](https://perena.gitbook.io/perena/protocol/perena-vault-v2)
and [shares/redemptions](https://perena.gitbook.io/perena/protocol/perena-vault-v2/for-users).
Actual redemption availability depends on the eventual vault configuration and liquidity.

## Verification

Run `pnpm lint`, `pnpm check-types`, `pnpm test`, and `pnpm --filter zivoe-dapp build`.
Focused tests: `pnpm --filter zivoe-dapp exec vitest run src/prototypes/perena`.

Authenticated browser checks:

- Compare the authenticated page with zSMB at 1440, 1024, 390, and 320 pixels; check sticky
  desktop Earn, mobile scrolling, a single dialog title, and no horizontal overflow.
- Switch NAV/Token Price, expand/collapse About, and check documentation/contact links.
- Follow the grid card; load the route and both tab links directly on desktop and mobile.
- Enter six-decimal amounts before and after connecting; verify exact estimated receive on both tabs.
- Connect the demo wallet, deposit, cancel a review, redeem partially and fully, reload, and reset.
- Reject empty/zero/negative amounts, more than six decimals, and amounts above the available balance.
- Confirm processing locks submission, tabs, and reset, then updates balances exactly once.
- Verify no transaction, approval, signing, receipt, or portfolio service calls result from demo actions.
- With the flag disabled or in a production environment, verify the card is absent and the route is 404.
- Confirm the real zSMB vault still has its normal wallet action and transaction UI.

### Preview smoke check

1. Sign in to the branch Preview and complete onboarding, or use the agent sign-in runbook
   after confirming that Preview has its own database and auth secret.
2. Reload `/`. Check that both the normal zSMB card and the additional Alternative Credit
   demo card appear, with the orange demo logo. Open Alternative Credit from its card.
3. Open both showcase deep links above. Check the desktop Earn panel and the mobile dialog.
4. Use the demo wallet, simulate a deposit, then simulate a partial redemption. Reload and
   confirm that balances and local activity persist in the same tab.
5. Select **Reset demo**. Confirm 1,000 demo USDC, zero shares, and no local activity.

### Verification record — 2026-09-23

- `pnpm lint`, `pnpm check-types`, `pnpm test`, and `pnpm --filter zivoe-dapp build` passed
  in the working checkout. Tests covered 501 dapp cases and 91 indexer cases (the unchanged
  indexer task used Turbo's cache). The local build loaded the development environment values
  into the process with `NODE_ENV=production`, an explicit isolated database URL, and no Sentry
  upload token; no release or deployment was created.
- Signed in through the local agent route on port 3002 against the existing isolated
  `zivoe-perena-demo-pg` database on `127.0.0.1:5434`. No migration was needed.
- Checked both grid cards, the orange logo, desktop layouts at 1440/1024 pixels, mobile layouts
  at 390/320 pixels, both deep links, the sticky desktop panel, and the single mobile Earn title.
  A 250.123456 USDC deposit followed by a 50.123456-share redemption left 800 USDC and 200 shares
  after reload. Redeeming the remaining shares on mobile restored 1,000 USDC; reset disconnected
  the demo wallet and cleared activity. The normal zSMB wallet and transaction controls remained present.
- Automated gate, proxy, route, and isolation tests passed for enabled Preview, disabled flags,
  production rejection, onboarding protection, and separation from live transaction services.
  Local development still emitted hydration warnings in shared UI and third-party integration
  errors; the demo interactions above completed successfully.
- Saved both explicit branch-scoped Preview variables. Existing Preview visibility was confirmed
  by the reviewer. The new settings will apply to the next user-triggered deployment; this
  verification did not deploy, push, or change Production configuration or Deployment Protection.

Use the GitHub PR preview workflow for review. Production publication is outside this prototype's scope.
