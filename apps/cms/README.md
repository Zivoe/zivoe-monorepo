# Zivoe CMS

Payload CMS admin for the landing site's Insights content — posts, authors, categories, media, and
editor users. Runs as its own Next.js app on port 3001; `/` redirects to `/admin`.

Content lives in its own Postgres database (`CMS_DATABASE_URL`), separate from the app database in
`@zivoe/database`. Media is stored in Cloudflare R2. Publishing a post revalidates the landing site
through `LANDING_REVALIDATE_URL`.

Types generated from the Payload config are committed to `@zivoe/cms-types` and consumed by the
landing app. `check-types` fails if they drift from the config, so run `generate:types` after any
collection change.

## Commands

Copy `.env.example` to `.env` first.

```bash
pnpm --filter zivoe-cms dev                  # Admin at http://localhost:3001/admin
pnpm --filter zivoe-cms db:migrate:create    # Generate a migration from config changes
pnpm --filter zivoe-cms db:migrate           # Apply pending migrations
pnpm --filter zivoe-cms db:studio            # Open Drizzle Studio against the CMS database
pnpm --filter zivoe-cms generate:types       # Regenerate @zivoe/cms-types from the Payload config
```
