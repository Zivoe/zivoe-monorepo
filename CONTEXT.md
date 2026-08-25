# Zivoe Web

Domain language for the Zivoe web monorepo (dApp, landing, CMS). Terms are added as modules are named; prefer these words in code, commits, and discussion.

## Language

### Transaction monitoring

**Transaction Monitor**:
The module that watches Centrifuge investor transactions (deposits, redemption requests, redemption executions and claims) via the Centrifuge indexer and posts Telegram alerts — `apps/dapp/src/server/utils/centrifuge-tx-monitor.ts` behind `/api/monitor/centrifuge-transactions`. One indexer feed covers every spoke chain of the environment, so new Zivoe Vaults and chains join the alerts with no monitor changes.
_Avoid_: cron route, notification job

**Monitor Pass**:
One QStash-triggered, advisory-lock-serialized run of the Transaction Monitor: freshness guard over the indexer head → fetch events behind the Monitor Cursor (plus an overlap window) → dedupe against the Notified Ledger → Telegram batch → record and advance the cursor. At-least-once end to end: a crash can repeat a message, never lose one.
_Avoid_: cron run, tick

**Monitor Cursor**:
A per-monitor epoch-milliseconds watermark in `monitor_cursor` marking event time processed up to. Only ever moves forward (a monotonic upsert guard — concurrent passes cannot rewind it), and its advance is clamped to the slowest active chain's indexed head, so a lagging chain's back-filled events can never fall behind the window. Replaced the archived monitor's per-kind `(blockNumber, logIndex)` cursor: indexer rows order by `createdAt`, and block heights are not comparable across spoke chains.
_Avoid_: checkpoint, offset

**Notified Ledger**:
`transaction_notified` — one row per alerted on-chain event, keyed by the canonical event id (`scId:centrifugeId:txHash:type:account`; addresses and hashes lowercase). Makes overlap replays and retries free — an event recorded here is never alerted again, which is what turns the Monitor Pass's at-least-once delivery into once-only alerts in every case but a crash between send and record. The same id slots into `transaction_email_sent.eventId` if per-user emails return.
_Avoid_: dedupe table, sent log

> The pre-Centrifuge implementation (Ponder-sourced, with per-user confirmation emails and a Monitor Kind adapter per event type) lives at `apps/dapp/archived/transaction-monitor`, excluded from typecheck and lint. It is frozen and unrunnable — it references the dropped `transaction_monitor_cursor` table — and is kept as the reference for reviving the email path (templates included).

### Client transactions

**Transaction Hook**:
A client module that drives one on-chain transaction through the shared lifecycle — guards → simulate → send → receipt toast → transaction dialog → refetches — via a declarative config. The lifecycle itself lives in `useTxLifecycle`; two drivers supply receipt acquisition: `useTx` for direct viem contract calls (approve) and `useCentrifugeTx` for Centrifuge SDK actions (deposit, request redeem, cancel redeem, claim redeem, claim returned shares).
_Avoid_: mutation hook (server-action mutations are not Transaction Hooks)

### Zivoe Vaults and redemptions

**Zivoe Vault**:
One Centrifuge share class exposed as a product page at `/vaults/<slug>`, described by the registry in `apps/dapp/src/zivoe-vaults`. Code spells the concept `ZivoeVault`/`zivoeVault`/`zivoe-vault` — never a bare `vault`, and never the retired names. In user-facing copy it is a plain "vault"/"Vaults": always this concept, without saying Zivoe, and copy never says "Centrifuge vault". The route folder `apps/dapp/src/app/(dashboard)/vaults/` carries the unqualified word because that folder name _is_ the public URL; the listing itself is `/`, and the bare `/vaults` prefix only redirects there. Centrifuge's model is Pool > Share Class > Vault: a pool holds N share classes (each with its own share token, price, NAV and yield history), and a Centrifuge Vault is one share class instantiated on one chain for one deposit asset — so a route is keyed by share class, not by Centrifuge Vault, and one Zivoe Vault accepting a second stablecoin or a second chain stays one Zivoe Vault.
_Avoid_: offering (the retired name — "offer"/"offering" must not reappear in identifiers, file names, comments or copy), opportunity (the pre-Centrifuge name), product; bare `vault` in code; Centrifuge vault in user-facing copy

**Centrifuge Vault**:
Centrifuge's own, narrower vault: one share class instantiated on one chain for one deposit asset, plus the on-chain address it lives at. Code NEVER says a bare `vault` — every identifier, file name and comment spells the sense out: `getCentrifugeVault`, `centrifugeVaultAddress`, `readCentrifugeVaultCapacity`, `CentrifugeVaultEntity`, `zivoeVault.centrifugeVaults`, `centrifuge-vault-receipt.ts`. Kept verbatim as exceptions: Centrifuge's own proper nouns (the SDK's `pool.vault()`, `ABI.VaultRouter`, the `VaultNotLinked` protocol error, `CentrifugeChainConfig.vaultRouterAddress` naming the VaultRouter contract) and the `'VAULT_CAPACITY'` cache string, which is already namespaced under `'CENTRIFUGE'`. To tell the senses apart: if it has an address, a chain or a deposit asset, it is a Centrifuge vault; if it has a slug, a page or a reader, it is a Zivoe Vault. One Zivoe Vault owns one Centrifuge vault per chain today, and several per chain the day a class accepts a second deposit asset — every Centrifuge-vault-scoped cache key carries the chain, which identifies the vault only while there is one per chain, so a second deposit asset must bring its own key dimension. User-facing copy names neither sense.
_Avoid_: a bare `vault` in identifiers, file names or code prose — qualify every occurrence

**Environment**:
One whole Centrifuge protocol universe — one hub, one SDK environment flag, one indexer covering every chain in it: `mainnet` or `testnet`. A deployment lives in exactly one environment, and hub-level facts (pool ids, share-class ids, Token Price, NAV) are identical across all of its chains.
_Avoid_: network (the retired term that meant both this and Chain)

**Chain**:
One spoke network inside an Environment (`ethereum`, `pharos`, `sepolia`, `base-sepolia`) where token instances and vaults are actually deployed. Wallet balances, vaults, whitelist membership, capacity and Redemption Positions are all chain-scoped. The deployment's environment comes from `NEXT_PUBLIC_CHAIN_ENV` (NODE*ENV-style: testnet for development/previews, mainnet for production); every chain of that environment is active, per-chain availability is the deployable flags' business, and every chain-scoped query key and vault memo carries the chain.
\_Avoid*: network (ambiguous)

**Share Class Catalog**:
The shared serializable record of every Centrifuge share class Zivoe integrates (`packages/centrifuge-indexer/src/catalog.ts`): symbol, decimals, and per-environment hub identity (pool id, scId) with per-chain token instances, `deployable: false` marking staged placeholder chains. The single source both apps derive share-class identity from; it guards its own symbol/id uniqueness at import.
_Avoid_: config (that is the chain-constants singleton), token list

**Share-Class Key**:
The Share Class Catalog key naming one class (e.g. `zSMB`) — the share-class dimension of query keys, caches, and Centrifuge Vault resolution. It travels as a plain string through providers and caches; `getShareClassIdentity` is the runtime trust boundary that validates it.
_Avoid_: scId (the on-chain id), symbol

**Zivoe Vault Module**:
One Zivoe Vault's registration in the dApp — identity (slug, Share-Class Key, per-chain Centrifuge Vaults) plus presentation (logo, copy, details, documents), e.g. `apps/dapp/src/zivoe-vaults/zsmb.tsx`. Listed in `REGISTERED_ZIVOE_VAULTS`; the registry invariants sweep every claimed chain at import, so a misregistration fails the build, never production traffic.
_Avoid_: vault config, offering module (retired)

**Transaction Identity**:
What a flow hands every Centrifuge Transaction Hook: `{ zivoeVaultSlug, shareClass }`, the resolved catalog identity joined with the Zivoe Vault's Centrifuge Vault on ONE chain via `resolveTransactionIdentity(zivoeVault, chain)` — the chain is part of the identity, picked by the flow's selector. The Centrifuge module never imports the registry — it trusts the identity it is handed, which keeps the test fixture class unregisterable.
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

> **Dev**: The transactions channel missed a deposit yesterday.
> **Expert**: Did a Monitor Pass fail, or did the Monitor Cursor skip past it?
> **Dev**: The pass failed at the Telegram send, so nothing was recorded in the Notified Ledger and the cursor never advanced — the next pass picked the event up again.
> **Expert**: Right, that's the design: a pass only records and moves the cursor after the send succeeded, and the ledger is what keeps the replay from alerting twice. If we ever need to watch a new event type, that's widening the indexer boundary and the ledger enum together, not a new cron route.

> **Dev**: The zSMB vault is throwing on Sepolia.
> **Expert**: Which one — the Vault, or the Centrifuge Vault behind it?
> **Dev**: The address in `ZSMB_ZIVOE_VAULT.centrifugeVaults.sepolia`. The SDK resolved a different one than we assert against.
> **Expert**: Then it's the Centrifuge Vault, and the fix is the Zivoe Vault Module's registration, not the page. The Zivoe Vault is fine — same share class, same slug, same URL, and nothing the user reads changes.
