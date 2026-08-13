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

### Zivoe Vaults and redemptions

**Zivoe Vault**:
One Centrifuge share class exposed as a product page at `/vaults/<slug>`, described by the registry in `apps/dapp/src/zivoe-vaults`. Code spells the concept `ZivoeVault`/`zivoeVault`/`zivoe-vault` — never a bare `vault`, and never the retired names. In user-facing copy it is a plain "vault"/"Vaults": always this concept, without saying Zivoe, and copy never says "Centrifuge vault". The route folder `apps/dapp/src/app/(dashboard)/vaults/` carries the unqualified word because that folder name _is_ the public URL; the listing itself is `/`, and the bare `/vaults` prefix only redirects there. Centrifuge's model is Pool > Share Class > Vault: a pool holds N share classes (each with its own share token, price, NAV and yield history), and a Centrifuge Vault is one share class instantiated on one network for one deposit asset — so a route is keyed by share class, not by Centrifuge Vault, and one Zivoe Vault accepting a second stablecoin stays one Zivoe Vault.
_Avoid_: offering (the retired name — "offer"/"offering" must not reappear in identifiers, file names, comments or copy), opportunity (the pre-Centrifuge name), product; bare `vault` in code; Centrifuge vault in user-facing copy

**Centrifuge Vault**:
Centrifuge's own, narrower vault: one share class instantiated on one network for one deposit asset, plus the on-chain address it lives at. Code NEVER says a bare `vault` — every identifier, file name and comment spells the sense out: `getCentrifugeVault`, `centrifugeVaultAddress`, `readCentrifugeVaultCapacity`, `CentrifugeVaultEntity`, `zivoeVault.centrifugeVaults`, `centrifuge-vault-receipt.ts`. Kept verbatim as exceptions: Centrifuge's own proper nouns (the SDK's `pool.vault()`, `ABI.VaultRouter`, the `VaultNotLinked` protocol error, `CENTRIFUGE_ENV.vaultRouterAddress` naming the VaultRouter contract) and the `'VAULT_CAPACITY'` cache string, which is already namespaced under `'CENTRIFUGE'`. To tell the senses apart: if it has an address, a network or a deposit asset, it is a Centrifuge vault; if it has a slug, a page or a reader, it is a Zivoe Vault. One Zivoe Vault owns one Centrifuge vault per network today, and several the day a class accepts a second deposit asset — which is why every Centrifuge-vault-scoped cache key carries the address, and why user-facing copy names neither.
_Avoid_: a bare `vault` in identifiers, file names or code prose — qualify every occurrence

**Share Class Catalog**:
The shared serializable record of every Centrifuge share class Zivoe integrates (`packages/centrifuge-indexer/src/catalog.ts`): symbol, decimals, and per-network on-chain identity, with `deployable: false` marking staged placeholder entries. The single source both apps derive share-class identity from; it guards its own symbol/id uniqueness at import.
_Avoid_: config (that is the network singleton), token list

**Share-Class Key**:
The Share Class Catalog key naming one class (e.g. `zSMB`) — the share-class dimension of query keys, caches, and Centrifuge Vault resolution. It travels as a plain string through providers and caches; `getShareClassIdentity` is the runtime trust boundary that validates it.
_Avoid_: scId (the on-chain id), symbol

**Zivoe Vault Module**:
One Zivoe Vault's registration in the dApp — identity (slug, Share-Class Key, per-network Centrifuge Vaults) plus presentation (logo, copy, details, documents), e.g. `apps/dapp/src/zivoe-vaults/zsmb.tsx`. Listed in `REGISTERED_ZIVOE_VAULTS`; the registry invariants sweep every claimed network at import, so a misregistration fails the build, never production traffic.
_Avoid_: vault config, offering module (retired)

**Transaction Identity**:
What a flow hands every Centrifuge Transaction Hook: `{ zivoeVaultSlug, shareClass }`, the resolved catalog identity joined with the Zivoe Vault's Centrifuge Vault on the active network via `resolveTransactionIdentity`. The Centrifuge module never imports the registry — it trusts the identity it is handed, which keeps the test fixture class unregisterable.
_Avoid_: vault context

**NAV**:
Net Asset Value: the user-facing name for a share class's value — Token Price × total issuance. Displayed as the full dollar amount truncated to whole dollars; only the chart Y axis keeps the compact k/M form. Internals and the indexer use `nav`/`navD18` too, so the term stays consistent from data through presentation.
_Avoid_: alternate names for this metric

**Token Price**:
The user-facing name for the share token's price, shown truncated to at most four decimals (trailing zeros trimmed, two-decimal minimum). Internals deliberately keep `sharePrice`/`sharePriceD18`, matching the SDK and indexer vocabulary — do not rename them.
_Avoid_: Share Price in user-facing copy

**Redemption Position**:
A wallet's in-flight redemption state on a share class: pending shares awaiting fulfillment, claimable USDC from fulfilled requests, and Returned Shares from cancellations.
_Avoid_: withdrawal, exit

**Returned Shares**:
Share tokens handed back by a redemption cancellation — the `claimableCancelRedeemShares` bucket, per share class. The SDK's aggregate claim empties this bucket first, so Returned Shares must be claimed before claiming redemption USDC.
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

> **Dev**: The zSMB vault is throwing on Sepolia.
> **Expert**: Which one — the Vault, or the Centrifuge Vault behind it?
> **Dev**: The address in `ZSMB_ZIVOE_VAULT.centrifugeVaults.sepolia`. The SDK resolved a different one than we assert against.
> **Expert**: Then it's the Centrifuge Vault, and the fix is the Zivoe Vault Module's registration, not the page. The Zivoe Vault is fine — same share class, same slug, same URL, and nothing the user reads changes.
