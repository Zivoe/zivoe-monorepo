# Zivoe Web

Domain language for the Zivoe web monorepo (dApp, landing, CMS). Terms are added as modules are named; prefer these words in code, commits, and discussion.

## Language

### Transaction monitoring

> Archived with the Centrifuge migration — the module now lives at `apps/dapp/archived/transaction-monitor` and is excluded from typecheck and lint. The vocabulary is kept for reading that code and for whatever replaces it.

**Transaction Monitor**:
The module that watches finalized on-chain transaction events and fans out user notifications (analytics, Telegram, confirmation emails with dedupe). One orchestration; everything kind-specific lives in a Monitor Kind.
_Avoid_: cron route, notification job

**Monitor Kind**:
The adapter config for one transaction event type — its ponder table, analytics event, Telegram line, and confirmation email. Two exist: deposits and redemptions.
_Avoid_: monitor config, flow (that means something else in observability tags)

**Monitor Pass**:
One QStash-triggered run of the Transaction Monitor for one Monitor Kind: advance from the Monitor Cursor to the safe block, notify, record, move the cursor.
_Avoid_: cron run, tick

**Monitor Cursor**:
The per-kind `(blockNumber, logIndex)` watermark marking the last processed event. Only ever moves forward — concurrent passes (QStash retries) cannot rewind it.
_Avoid_: checkpoint, offset

### Client transactions

**Transaction Hook**:
A client module that drives one on-chain transaction through the shared lifecycle — guards → simulate → send → receipt toast → transaction dialog → refetches — via a declarative config. The lifecycle itself lives in `useTxLifecycle`; two drivers supply receipt acquisition: `useTx` for direct viem contract calls (approve) and `useCentrifugeTx` for Centrifuge SDK actions (deposit, request redeem, cancel redeem, claim redeem, claim returned shares).
_Avoid_: mutation hook (server-action mutations are not Transaction Hooks)

### Offerings and redemptions

**Offering**:
One Centrifuge share class exposed as a product page at `/offerings/<slug>`, described by the registry in `apps/dapp/src/offerings`. Centrifuge's model is Pool > Share Class > Vault: a pool holds N share classes (each with its own share token, price, AUM and yield history), and a vault is one share class instantiated on one network for one deposit asset — so a route is keyed by share class, not by vault, and one Offering accepting a second stablecoin stays one Offering.
_Avoid_: opportunity (the pre-Centrifuge name), vault, product

**AUM**:
The user-facing name for a share class's value — Token Price × total issuance. Internals and the indexer deliberately keep `nav`/`navD18`; the rename is presentational only.
_Avoid_: NAV in user-facing copy

**Token Price**:
The user-facing name for the share token's price, shown to two decimals like AUM. Internals deliberately keep `sharePrice`/`sharePriceD18`, matching the SDK and indexer vocabulary — do not rename them.
_Avoid_: Share Price in user-facing copy

**Redemption Position**:
A wallet's in-flight redemption state on a share class: pending shares awaiting fulfillment, claimable USDC from fulfilled requests, and Returned Shares from cancellations.
_Avoid_: withdrawal, exit

**Returned Shares**:
zMCA handed back by a redemption cancellation — the `claimableCancelRedeemShares` bucket. The SDK's aggregate claim empties this bucket first, so Returned Shares must be claimed before claiming redemption USDC.
_Avoid_: refunded shares, cancelled shares

**Cancellation Processing**:
The window after a cancel request while the hub unwinds it (`hasPendingCancelRedeemRequest`). The redeem form locks — a new request would revert on-chain until the unwind lands.
_Avoid_: pending cancel (ambiguous with a pending redeem request)

**Split Outcome**:
A Redemption Position holding both claimable USDC and Returned Shares at once — a cancellation landed after partial fulfillment. The UI gates the USDC claim behind the Returned Shares claim.
_Avoid_: partial cancel

## Example dialogue

> **Dev**: The redemptions cron missed an event yesterday.
> **Expert**: Did a Monitor Pass fail, or did the Monitor Cursor skip past it?
> **Dev**: The pass failed at `send_email`, so the cursor never advanced — the next pass picked the event up again.
> **Expert**: Right, that's the design: a pass only moves the cursor after the event's notifications are recorded. If we ever need to watch a new event type, that's a new Monitor Kind, not a new cron route.
