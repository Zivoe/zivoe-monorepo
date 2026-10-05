# @zivoe/database

Schema, migrations, tooling, and shared queries for the primary Postgres database used by the dapp.

## Local database

Run a blank Postgres in Docker instead of pointing local dev at staging. Point both `.env` files
at it **first** — `db:migrate` applies migrations to whatever `packages/database/.env` holds, so
a leftover staging URL would receive them:

```bash
# packages/database/.env and apps/dapp/.env
DATABASE_URL=postgresql://zivoe:zivoe@localhost:5433/zivoe
```

Then:

```bash
pnpm --filter @zivoe/database db:up       # start Postgres 18 on localhost:5433
pnpm --filter @zivoe/database db:migrate  # apply every migration to it
```

Data lives in the `zivoe-postgres-data` Docker volume and
survives `db:down`; `db:reset` drops the volume and re-migrates from scratch.

The apps' own `.env` files are what the dev servers read — this package's `.env` only drives
drizzle-kit. Everything else in `apps/dapp/.env` (Persona, Resend, Telegram, Redis) stays as it is.

## Commands

Set `DATABASE_URL` in `packages/database/.env` first (see `.env.example`).

```bash
pnpm --filter @zivoe/database db:generate  # Generate a migration from schema changes
pnpm --filter @zivoe/database db:migrate   # Apply pending migrations
pnpm --filter @zivoe/database db:push      # Push schema directly (dev only; see note below)
pnpm --filter @zivoe/database db:seed      # Create the agent account, terms accepted and onboarded (--fresh deletes it)
pnpm --filter @zivoe/database db:studio    # Open Drizzle Studio

pnpm --filter @zivoe/database db:up        # Start the local Docker Postgres
pnpm --filter @zivoe/database db:down      # Stop it (data is kept)
pnpm --filter @zivoe/database db:reset     # Drop the volume, recreate, re-migrate
```

## Terms of use

`app_config` holds one row for the whole app; its `terms_updated_at` is the version of the terms
users must have accepted. Each acceptance on the dapp's `/terms` page is a row in
`terms_acceptance`. Publish the new terms first, then move the timestamp forward: every user is
sent back to `/terms` on their next page load, and an acceptance made after it counts as current.

```sql
UPDATE app_config SET terms_updated_at = now(), updated_at = now();
```

`db:push` creates types and tables without recording a migration, so a later `db:migrate` on the
same database fails at the first `CREATE TYPE` it already has. Use `db:migrate` on the Docker
database; `db:push` only on a throwaway you will `db:reset`.
