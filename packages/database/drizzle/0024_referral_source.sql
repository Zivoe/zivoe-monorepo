ALTER TYPE "public"."how_found_zivoe" RENAME TO "referral_source";--> statement-breakpoint
ALTER TABLE "profile" RENAME COLUMN "how_found_zivoe" TO "referral_source";--> statement-breakpoint
-- Postgres 18 names a NOT NULL constraint after its column and keeps that name through a column rename. Older
-- versions (and PGlite) have no such constraint, hence the guard.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profile'::regclass AND conname = 'profile_how_found_zivoe_not_null'
  ) THEN
    ALTER TABLE "profile" RENAME CONSTRAINT "profile_how_found_zivoe_not_null" TO "profile_referral_source_not_null";
  END IF;
END $$;
