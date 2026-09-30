# Portfolio data review

Reviewed on 2026-09-23 against the local implementation, installed Centrifuge SDK 2.5.0, the public mainnet GraphQL API, and Centrifuge's indexer source. Scope: the connected wallet's zSMB and the four planned asset rows across zSMB's supported chains.

## Loading failure reproduced and repaired locally

The configured development mainnet Alchemy app returned HTTP 403 with `App is inactive` on all ten chains. Ethereum's default public RPC returned HTTP 429. The SDK resolves spoke vaults through a hub `shareClassCount` read, so this Ethereum outage failed every redemption-position query. Base's default public endpoint also returned `over rate limit` during `supportsInterface`.

Added independent Ethereum and Base public RPC fallbacks to the shared RPC configuration used by wagmi and the SDK. Holdings now display successfully loaded wallet amounts even when another balance or request read fails. Incomplete portfolio totals and allocation percentages remain withheld.

After the fixes, the browser completed the current catalog's reads across all ten chains and displayed holdings, allocation, and a portfolio total. This proves the immediate loading problem is repaired; it does not prove coverage of vaults omitted from the catalog. The inactive dedicated Alchemy app still needs replacement or reactivation for a dependable primary endpoint.

Validation for this repair: two transport failover tests, five portfolio accounting tests, one partial-holdings rendering test, affected-file lint, and both dapp/indexer type checks passed. The public endpoints are documented by [PublicNode Ethereum](https://ethereum.publicnode.com/) and [PublicNode Base](https://base.publicnode.com/).

## Coverage findings

A flat `tokenInstances` / `vaults` query filtered by pool/share class at `2026-09-23T16:24:48Z` returned ten share-token chains and 24 vault records: 23 linked sync-deposit/async-redeem vaults and one unlinked async vault. The local catalog contains 20 vaults on those same ten chains.

| Chain     | Catalog vaults | Indexed vaults | Omitted from catalog           |
| --------- | -------------: | -------------: | ------------------------------ |
| Ethereum  |              3 |              4 | Old USDC async vault, unlinked |
| Pharos    |              1 |              1 | —                              |
| Base      |              1 |              1 | —                              |
| Arbitrum  |              2 |              2 | —                              |
| Avalanche |              2 |              2 | —                              |
| Optimism  |              2 |              2 | —                              |
| HyperEVM  |              2 |              2 | —                              |
| X Layer   |              2 |              3 | USD1                           |
| BNB Chain |              3 |              3 | —                              |
| Monad     |              2 |              4 | USD1 and AUSD                  |

The omitted records are:

- X Layer USD1 vault `0x8047b87112d541e331232f62d5532d61a87fd4b1`; indexed asset decimals: 18.
- Monad USD1 vault at the same address; indexed asset decimals: 6. Never deduplicate across chains or infer decimals from the symbol/address alone.
- Monad AUSD vault `0xe32d423a78eab6349b88b45cdf765d5c7a7c3518`; asset is outside the four planned rows.
- Ethereum old USDC vault `0x9952ab39483f9fea234597c4938e0a2d2bb891ab`; `isActive: true` but `status: Unlinked`. Unlinked does not establish that an investor has no remaining entitlement.

These are indexer observations, not completed on-chain deployment validation. Verify asset, share token, decimals, manager, and vault kind before changing supported transaction routes. Do not treat `isActive` alone as proof that a vault is linked. Centrifuge documents vaults as chain- and deposit-asset-specific entities in its [API reference](https://developer.centrifuge.io/developer/centrifuge-api/#vaults).

The portfolio currently derives its coverage entirely from transaction-enabled catalog identities. Therefore “all chains” currently means all catalog entries, not every protocol position. It can report a complete portfolio while an omitted vault has an outstanding position.

## Component contracts

| Component            | Correct data contract                                                                                                                                                    | Implementation work                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Available holdings   | ERC-20 `balanceOf(wallet)` for each supported `(EVM chain ID, token address)`; retain declared decimals                                                                  | Existing deduplication and integer arithmetic are appropriate. Verify and add the two USD1 instances. Make supported stablecoin instances explicit; a symbol does not imply every bridged variant is included. |
| Requests             | Current controller position for every relevant `(chain, vault, wallet)`, regardless of where the request was submitted                                                   | Separate portfolio read coverage from deposit availability. Include legacy vaults until they are proven to have no residual obligations. Preserve payout-asset identity.                                       |
| Total value          | Available shares, escrowed pending shares, and returned shares at the hub Token Price; wallet stablecoins and settled stablecoin proceeds at the disclosed $1 convention | Keep share-equivalent bookkeeping out of the sum. Distinguish funding and access restrictions from ownership. Unsupported proceeds must be surfaced as unpriced rather than omitted or assigned $1.            |
| Allocation           | Exactly the asset totals used by the headline, with the same completeness state                                                                                          | Current shared model is appropriate. Keep percentages unavailable while the denominator is incomplete; show chain progress and known balances separately.                                                      |
| Chain modal          | Independent balance/request status, amount, valuation, and last successful read per chain                                                                                | Add source block/time and clearer fresh/stale/failed states. A last-known value is not a current lower bound.                                                                                                  |
| Wallet-value history | Complete wallet balance changes per chain, daily historical hub prices, and a separately identified live endpoint                                                        | Add ingestion checks, null intervals with missing balance changes, and evaluate completeness for the selected range.                                                                                           |
| Activity             | Indexed protocol actions and transfers, with explicit chain, asset denomination, and stable event identity                                                               | Classify mint/burn/escrow legs; group related actions where appropriate. Deduplicate pagination and expose indexer delay.                                                                                      |
| Target APY           | Configured indicative target plus existing disclosure                                                                                                                    | Keep separate from Token Price appreciation and wallet value changes. Stablecoin APY remains “—”.                                                                                                              |

The requests card describes amounts already contained in the holdings model. It never contributes a second amount to the portfolio total.

## Recommended request reader

Use a read-only position adapter backed by verified vault/manager/escrow identities. Read wallet balances, raw request-manager state, and escrow funding at one pinned block per chain, preferably in batched calls. Chains need their own block numbers; there is no common multichain block height. Keep the existing SDK transaction guards and signing flow.

The adapter should return raw ownership and separate availability facts:

| Protocol amount / fact         | Portfolio treatment                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `pendingRedeemRequest`         | Pending zSMB shares, including a cancellation still processing                                                  |
| `pendingCancelRedeemRequest`   | State flag; never add the amount a second time                                                                  |
| `claimableCancelRedeemRequest` | Returned zSMB shares awaiting claim                                                                             |
| `maxWithdraw`                  | Settled proceeds in the vault's payout asset                                                                    |
| Escrow funding                 | Partition settled proceeds into ready-to-claim or awaiting-liquidity presentation; never remove the entitlement |
| Transfer/access restrictions   | Explain an unavailable action separately; do not erase owned value                                              |
| `maxRedeem` / share equivalent | Bookkeeping only once asset-denominated proceeds have been counted                                              |

The current SDK reader plus `readUnfundedClaim` already covers these redemption buckets for catalogued vaults. Its main weaknesses are expensive shared hub resolution, duplicated RPC reads, and reads from potentially different blocks. A request or claim between independent balance and position reads can temporarily double-count or omit value.

Treat old async vaults separately: they may also have pending deposits, deposit cancellations, or unclaimed deposited shares. Investigate these before promising a complete current portfolio. The existing four-asset model only handles redemption states.

Refresh successful balances and positions while the page is visible, on reconnect/focus, after local transactions, and through manual Refresh. Preserve five-minute freshness for ordinary reads; use a shorter bounded refresh for active requests if needed. Currently successful request queries do not poll, SDK event repetition is disabled, and window-focus refetch is disabled. Approvals made outside this dapp can therefore remain invisible until a remount or manual refresh. Leave the Transaction Monitor's event scope unchanged.

## History and activity findings

`buildWalletHistory` detects discontinuities between one checkpoint's `balanceAfter` and the next checkpoint's `balanceBefore`, but only sets a global `complete = false`. It still carries a numeric balance through the unknown interval. Those daily points should be null so the chart cannot draw an unsupported line. Completeness should also be calculated for the selected chart range, allowing a verified recent range even if much older history is missing.

Centrifuge's checkpoint writer can skip checkpoint creation when a token price is unavailable while still updating the indexed balance. Pagination reaching the end therefore does not prove every balance-changing transfer has a checkpoint. Reconcile against indexed positions and on-chain balances, use available transfer data to fill only provable gaps, and leave other intervals unknown. Source reviewed: [TokenInstanceService at commit 6374602](https://github.com/centrifuge/api-v3/blob/6374602073918bf01a4ce560886d9c4406ab0949/src/services/TokenInstanceService.ts).

Reuse `fetchIndexerChainStatuses` for history/activity ingestion status. In the live review, most chains' indexed timestamps were approximately three minutes behind wall clock and Avalanche was approximately fifteen minutes behind. Calibrate acceptable delay per chain/finality; do not label an empty but stale indexer response as confirmed absence of history. This check is independent of RPC completeness for current holdings.

The browser's Recent feed showed both a Pharos Deposit and Transfer in for the same transaction. The indexer writes transfer records from share-token transfers, so these can be two views of one mint rather than two independent additions. The Transfers tab should distinguish user transfers, bridging, mint/burn, and request/claim escrow movements. Include the available transfer-leg/message fields where populated, but do not assume every bridge is paired by those fields without validating live data.

Use chain-aware transaction identity and deterministic pagination. Never combine separate vault positions merely because token addresses, transaction hashes, or payout symbols match. Keep requests as current states and activity as historical events.

## Implementation order and acceptance checks

1. Validate the omitted deployments; maintain separate read coverage and enabled deposit/redeem routes. Reconcile discovery with the catalog, retain legacy positions, and decide how AUSD proceeds appear without expanding the four-asset valuation assumption silently.
2. Introduce the batched position adapter and per-chain block/freshness metadata. Preserve shared balance/position cache keys and account-prefix invalidation.
3. Add successful-read refresh and explicit chain progress. A single chain failure must preserve known amounts and positions while withholding an incomplete total.
4. Repair historical balance gaps and ingestion checks; classify activity entries and verify bridge semantics against populated examples.
5. Validate a real nonempty position through request, partial execution, cancellation, returned shares, funded claim, and liquidity shortfall. Compare amounts directly with contracts on each relevant chain. Include legacy vaults, multiple payout assets, 6/18-decimal USD1 instances, and wallet switches during reads.

No production configuration was changed and no transaction was signed. All development changes remain local and uncommitted.
