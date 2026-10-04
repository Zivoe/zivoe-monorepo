CREATE TYPE "public"."kyc_status" AS ENUM('not_started', 'in_progress', 'submitted', 'pending_review', 'approved', 'declined', 'failed', 'expired', 'manually_approved', 'revoked');--> statement-breakpoint
CREATE TABLE "kyc_verification" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" "kyc_status" NOT NULL,
	"persona_inquiry_id" text,
	"persona_account_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"status_changed_at" timestamp with time zone NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD CONSTRAINT "kyc_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyc_verification_status_last_synced_idx" ON "kyc_verification" USING btree ("status","last_synced_at");--> statement-breakpoint
CREATE INDEX "kyc_verification_status_changed_idx" ON "kyc_verification" USING btree ("status","status_changed_at");