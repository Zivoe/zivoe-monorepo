# @zivoe/database

Schema, migrations, tooling, and shared queries for the primary Postgres database used by the dapp
and the landing page. Background and trade-offs: [ADR 0001](../../docs/adr/0001-shared-database-package.md).

## Exports

| Path                         | Contents                                                |
| ---------------------------- | ------------------------------------------------------- |
| `@zivoe/database`            | `createDatabase`, shared queries, and schema re-export  |
| `@zivoe/database/schema`     | Tables, enums, and row types                            |
| `@zivoe/database/onboarding` | Onboarding enum values/types without pulling in drizzle |

Apps own their connection and pass it in:

```ts
import postgres from 'postgres';

import { createDatabase } from '@zivoe/database';

const client = postgres(env.DATABASE_URL, { prepare: false });
export const db = createDatabase(client);
```

## Commands

Set `DATABASE_URL` in `packages/database/.env` first (see `.env.example`).

```bash
pnpm --filter @zivoe/database db:generate  # Generate a migration from schema changes
pnpm --filter @zivoe/database db:migrate   # Apply pending migrations
pnpm --filter @zivoe/database db:push      # Push schema directly (dev only)
pnpm --filter @zivoe/database db:studio    # Open Drizzle Studio
```

The migration journal continues the history that `apps/dapp/drizzle-auth` started: `DATABASE_URL`
must point at the database that ran those migrations (the former `AUTH_DATABASE_URL` target), or
the journal will not line up. Against that database, `db:migrate` only applies what is new.

## Restore runbook: protocol daily snapshots

`daily_data` can be rebuilt from chain at any time — no Mongo, no backup needed. The dapp exposes
an idempotent backfill endpoint that recomputes snapshots per day and upserts them:

```bash
curl -X POST https://app.zivoe.com/api/monitor/network/backfill \
  -H "X-API-Key: $ZIVOE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "startDate": "2025-05-16", "endDate": "2025-08-31" }'
```

- Dates are inclusive `YYYY-MM-DD`; the range must not include today (the hourly cron owns today).
- Days are processed in parallel batches of 30 and each batch is persisted before the next starts,
  so a timeout loses no progress — re-run the remaining range.
- Caches (dapp tag + landing stats) are revalidated automatically when the run completes.
- Re-running over existing days is safe: rows are upserted by timestamp.
