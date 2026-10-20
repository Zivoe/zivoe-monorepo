# A Linked address is proven by a signature, not by a transaction

**Status:** decided 2026-10-03 with Alex, implemented as the Wallets step of `/verification`.
Follows the Transaction Gate decision (`docs/decisions/kyc-transaction-gate.md`), which left
"Get whitelisted" pointing at `/verification` for the step this record describes.

**What this is:** how an investor proves they control the address Zivoe will whitelist, and what
the proof is allowed to change in the database.

## The rule

An investor with a yes Decision (Persona's for an individual, the team's `manually_approved` for an
organization) connects a wallet, the server issues a Wallet link challenge, the wallet signs it with
`eth_signTypedData_v4`, and the server verifies the signature on the chain the message names with
viem's contract-aware `verifyTypedData`. One call covers an EOA (ECDSA recovery), a deployed smart
wallet (EIP-1271) and a not-yet-deployed one (ERC-6492). The verified row becomes a Linked address;
the signature and the exact typed data it signed stay on the row as an independently checkable
Ownership proof.

- **The challenge is deterministic for its lifetime** (24 hours): the same (user, address) gets the
  same nonce, issue and expiry until it expires, so a Safe whose co-signers finished later hands
  back the stored signature on the next click. A different chain is a different domain and
  re-issues.
- **One request per account and address, not one address per person.** The partial unique index is
  on `(user_id, address) where status = 'linked'`; several accounts may each hold a request for the
  same address, and an account only ever reads its own. Issuing a challenge never says whether an
  address is another account's, or any approved investor could probe for Zivoe's customer
  addresses. A Revoke request names the other accounts that connected the address, so ops decides
  with all of them in view.
- **The message names the account by id, never by email.** A Safe stores every message it signs in
  the Safe Transaction Service, readable by anyone who knows the Safe's address; an email there
  would tie the address to a person in public.
- **Chainalysis before any signature and again on write**: the client never shows the sign button
  for a High or Severe address; the server screens at issue and at completion, and a flagged
  address leaves no row.
- **No per-chain whitelist state in the database.** Whether an address is a member is always read
  from each chain; `whitelist_observed_at` only records when the reconcile first saw full
  membership.

## Why a signature and not a transaction

- **It is free and moves nothing.** An on-chain proof would cost gas on a chain the investor may
  not hold the native token of, and would put a Zivoe contract between the investor and a step
  that only needs an assertion.
- **The signature is the same proof the protocol already trusts.** A whitelisted wallet acts by
  signing; proving control by signing is the exact capability being whitelisted.
- **It is independently checkable.** The stored `typed_data` plus `signature` verify without
  Zivoe's database: anyone with the row and an RPC can recompute the answer.
- **Smart wallets are covered by the same call.** EIP-1271 and ERC-6492 fold into
  `verifyTypedData`; a transaction path would have needed its own smart-wallet handling.

## The accepted gap: multi-approver wallets must coordinate

A policy-gated EOA (Fireblocks, MPCVault and similar) answers one `eth_signTypedData_v4` request;
every approver must approve inside the wallet's own request window while the investor keeps the
tab open. A Safe above threshold one either keeps the Safe modal open or comes back inside the day
after the co-signers signed and clicks again, which the deterministic challenge makes work. The
helper copy under the sign button says so. The expectation is that signers sit together and finish
in one sitting; no on-chain alternative in this release.

A smart account exists per chain, so its proof holds on the signing chain only; the operator line
says so, and admitting it on every live chain is ops' call.

## `wallet_connection` stays what it is

`wallet_connection` is the analytics upsert `WalletTracker` performs on every connection: no new
column, no new index, no foreign key from `wallet_link`. The product expectation — every
`wallet_link` row's (user, address) also exists in `wallet_connection` — is guaranteed by the write
that flips a row to `linked`, inside the same database transaction, with an insert-if-absent that
never overwrites what the tracker recorded.

## What this leaves to operations

- **Whitelisting is manual.** Every link reaches the wallet-link Telegram channel through the
  Outbox as a Whitelist request, with where the address stands on the chains at delivery; ops
  whitelists on Centrifuge by hand.
- **Propagation is observed, not repaired.** The hourly reconcile reads membership on every live
  chain, emails the investor the first time an address is a member everywhere, and lists the rows
  still not whitelisted on days 3, 7, 14 and 30 after the request in one Telegram digest a day.
  A stalled whitelist is the operators' work, not an app fault, so it does not go to Sentry; only
  a chain the sweep could not read does. Nothing in this codebase retries a Centrifuge message.
- **A no Decision ends the links.** When an investor's Decision becomes declined or revoked, the
  next reconcile removes their Linked addresses and queues a Revoke request for each; ops revokes
  on Centrifuge by hand. Whether the revoke was carried out is not read back: a row seen
  whitelisted once is never read again.
- **A new chain is a rollout.** Rows already seen whitelisted are not re-read when a chain goes
  live; existing members are whitelisted on the new chain as part of launching it.

## Rejected

- **An on-chain proof** (a transaction from the address): gas, a contract to deploy and maintain,
  and no advantage over the signature for the wallets Zivoe serves.
- **Fireblocks automation in this branch**: the submitter, its webhook and automated revocation are
  later work; until then Telegram is a request, not a notification.
- **Per-chain whitelist columns**: the chain is the truth, and two sources of it would disagree
  exactly when it mattered.
