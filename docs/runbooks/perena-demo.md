# Zivoe Alternative Credit prototype

Zivoe Alternative Credit is an internal/partner review prototype at `/vaults/perena-usdc-demo`. Its card appears in the
Vaults grid at `/` (`/vaults` redirects there). It is separate from the real vault registry.

## Enable for review

- Set the server variable `PERENA_DEMO_ENABLED=true` under local `next dev`, or on a Vercel
  **Preview** deployment. The flag defaults to `false`.
- On Vercel, scope the flag to the preview branch being reviewed. Production is rejected even
  when the flag is set: `VERCEL_ENV=production` or `NEXT_PUBLIC_ENV=production` blocks access.
  A non-Vercel production build is also blocked. Never publish this prototype to production.
- The proxy rejects disabled/production requests with HTTP 404 before any layout can stream;
  the dynamic route also checks the environment. The grid's demo card is
  rendered behind a request-time check so preview visibility is not baked into the static shell.
- Sign in and complete onboarding as usual. For agent testing, follow [agent sign-in](agent-sign-in.md)
  with a separate local/preview database. The demo does not bypass either step.

Direct links: `?view=deposit` and `?view=redeem`. On mobile these open the transaction dialog.
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

Use the GitHub PR preview workflow for review. Production publication is outside this prototype's scope.
