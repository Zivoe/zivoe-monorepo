# Chain data fallbacks

The shared `getChainRpcUrls` configuration serves wagmi wallet reads and receipt checks, the Centrifuge SDK, server contract readers, and deployment verification. Each chain tries Alchemy when configured, then viem's public defaults, an optional additional provider, and the public backups below. Duplicate URLs are removed.

| Chain        | Extra public backup                                  |
| ------------ | ---------------------------------------------------- |
| Ethereum     | `https://ethereum-rpc.publicnode.com`                |
| Pharos       | Configurable; see below                              |
| Base         | `https://base-rpc.publicnode.com`                    |
| Arbitrum     | `https://arbitrum-one-rpc.publicnode.com`            |
| Avalanche    | `https://avalanche-c-chain-rpc.publicnode.com`       |
| Optimism     | `https://optimism-rpc.publicnode.com`                |
| HyperEVM     | `https://hyperliquid.drpc.org`                       |
| X Layer      | `https://rpc.xlayer.tech`, `https://xlayer.drpc.org` |
| BNB          | `https://bsc-rpc.publicnode.com`                     |
| Monad        | `https://rpc2.monad.xyz`                             |
| Sepolia      | `https://ethereum-sepolia-rpc.publicnode.com`        |
| Base Sepolia | `https://base-sepolia-rpc.publicnode.com`            |

These backups were checked on 2026-09-29 for chain IDs, zSMB `decimals` and `balanceOf` contract reads without an explicit gas limit, and browser CORS preflights. Providers document these endpoints at [PublicNode](https://publicnode.com/), [dRPC HyperEVM](https://drpc.org/chainlist/hyperliquid-mainnet-rpc), [dRPC X Layer](https://drpc.org/chainlist/xlayer-mainnet-rpc), [OKX X Layer](https://web3.okx.com/onchainos/dev-docs/xlayer/developer/rpc-endpoints/rpc-endpoints), and [Monad network information](https://docs.monad.xyz/developer-essentials/network-information).

## Pharos

Pharos retains Alchemy and `https://rpc.pharos.xyz`. The additional public `https://pharos.drpc.org` endpoint was excluded: a standard uncapped zSMB `balanceOf` call returned HTTP 400 / JSON-RPC -32601; specifying a gas cap made that same read work. The default requests issued by wagmi and the SDK do not specify that cap. Similarly, Monad's dRPC endpoints returned a provider gas-limit error, so Monad uses a different verified provider.

Set optional `NEXT_PUBLIC_PHAROS_RPC_FALLBACK_URL` to a compatible HTTPS endpoint in the dapp environment and restart the dev server (or rebuild for a preview). This is a browser-visible URL; use a provider credential intended for browser RPC access. The app and deployment verifier both include it automatically after the standard Pharos public endpoint. Before configuring one, verify chain ID 1672, uncapped token/vault contract reads, browser CORS, and SDK multicalls. [ZAN documents an additional Pharos provider](https://docs.zan.top/reference/api-instructions), requiring its own API key; none was provisioned during this repair.

## Indexer data

History, activity, token prices, NAV, and ingestion status use the environment's Centrifuge GraphQL API through `fetchCentrifugeIndexer`. The wrapper retries once after a connection failure, HTTP 408/425/429, or HTTP 5xx, with a 250 ms delay. Both attempts share the original abort signal and timeout (10 seconds by default). Cancellation, other HTTP errors, GraphQL errors, and malformed responses do not retry.

The retry uses the same upstream. No independent indexer mirror was verified, and an RPC cannot substitute for indexed history or activity. Mainnet continues to use [Centrifuge's published API](https://docs.centrifuge.io/developer/centrifuge-api/); testnet retains its separate API. SDK indexer requests retain the SDK's own behavior. Portfolio sections still load as their data becomes available.

Public backups also have rate limits. The development Alchemy app previously returned `App is inactive`; reactivating it or configuring an active primary key remains advisable.
