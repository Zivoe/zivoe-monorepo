## Zivoe Landing Page

The homepage reads live zSMB metrics from `/api/home-metrics`. NAV sums each
network's outstanding supply multiplied by its published price; Token Price
uses the share-class publication. Both use Centrifuge's indexer selected by
`NEXT_PUBLIC_CHAIN_ENV`, with no API keys, RPC credentials, or database connection.
The shared network reader rejects incomplete results, inconsistent supplies, and
indexed blocks more than five minutes old. Integer precision is retained through
display rounding.

The API exposes only NAV and Token Price, with values, source/read timestamps,
and availability status. NAV's integer string has 36 USD decimals; Token Price
has 18.
NAV's source timestamp is the oldest contributing network price publication;
its indexed timestamp is the oldest contributing indexed block.

The indexer reader caches reads for 60 seconds per running server instance and
coalesces concurrent requests. Failures retain that instance's last successful
reading and timestamps as `stale`. A cold instance without a successful read
returns `unavailable`. The browser also retains successful readings during API
failures or cold-instance misses, refreshes every 60 seconds while visible, and
refreshes on returning to the tab.
Cache contents do not persist across server restarts.

The Lighthouse showcase uses a dated local dashboard image and links to Lighthouse;
it does not fetch data from the Lighthouse application.

Run `pnpm --filter zivoe-landing test` for rounding and cache recovery, and
`pnpm --filter @zivoe/centrifuge-indexer test` for network aggregation checks.
