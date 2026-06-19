# @zivoe/database

Schema, migrations, tooling, and shared queries for the primary Postgres database used by the dapp
and the landing page.

## Commands

Set `DATABASE_URL` in `packages/database/.env` first (see `.env.example`).

```bash
pnpm --filter @zivoe/database db:generate  # Generate a migration from schema changes
pnpm --filter @zivoe/database db:migrate   # Apply pending migrations
pnpm --filter @zivoe/database db:push      # Push schema directly (dev only)
pnpm --filter @zivoe/database db:studio    # Open Drizzle Studio
```
