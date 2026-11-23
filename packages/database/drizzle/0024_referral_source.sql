ALTER TYPE "public"."how_found_zivoe" RENAME TO "referral_source";--> statement-breakpoint
ALTER TABLE "profile" RENAME COLUMN "how_found_zivoe" TO "referral_source";
