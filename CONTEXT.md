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
A client module that drives one on-chain transaction through the shared lifecycle — guards → simulate → send → receipt toast → transaction dialog → refetches — via a declarative config. Two drivers implement that lifecycle: `useTx` for direct viem contract calls (approve) and `useCentrifugeTx` for Centrifuge SDK actions (deposit, request redeem, cancel redeem, claim redeem, claim returned shares).
_Avoid_: mutation hook (server-action mutations are not Transaction Hooks)

## Example dialogue

> **Dev**: The redemptions cron missed an event yesterday.
> **Expert**: Did a Monitor Pass fail, or did the Monitor Cursor skip past it?
> **Dev**: The pass failed at `send_email`, so the cursor never advanced — the next pass picked the event up again.
> **Expert**: Right, that's the design: a pass only moves the cursor after the event's notifications are recorded. If we ever need to watch a new event type, that's a new Monitor Kind, not a new cron route.
