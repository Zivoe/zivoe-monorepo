-- source_at orders Persona snapshots. Its default only serves an app that predates the column (between this
-- migration and the deploy after it); every existing row's newest snapshot is its last status change.
ALTER TABLE "kyc_verification" ADD COLUMN "source_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "kyc_verification" SET "source_at" = "status_changed_at";--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;
