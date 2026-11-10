import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres';

// Payload 3.90 added two fields: `resetPasswordRequestedAt` on auth collections (throttles
// forgot-password) and `_objectKey` on upload collections (per-upload storage folder).
//
// Run this BEFORE deploying the Payload 3.93 code: it selects both columns on every login, every
// media read and every post read that populates an image, and the 3.80 code ignores them.
// IF NOT EXISTS keeps the migration usable on a database where `next dev` already pushed the
// columns. It does not help a database whose `payload_migrations` table lacks the initial
// migration: there `payload migrate` re-runs that one first and stops.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_password_requested_at" timestamp(3) with time zone;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN IF EXISTS "reset_password_requested_at";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "_objectkey";`);
}
