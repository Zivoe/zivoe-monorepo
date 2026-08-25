CREATE TYPE "public"."investor_transaction_type" AS ENUM('SYNC_DEPOSIT', 'REDEEM_REQUEST_UPDATED');--> statement-breakpoint
CREATE TABLE "monitor_cursor" (
	"monitor" text PRIMARY KEY NOT NULL,
	"last_event_at" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_notified" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" "investor_transaction_type" NOT NULL,
	"tx_hash" text NOT NULL,
	"account" text NOT NULL,
	"centrifuge_id" text NOT NULL,
	"event_at" bigint NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_monitor_cursor" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "transaction_monitor_cursor";--> statement-breakpoint
-- The retired monitor's dedupe rows use its old event-id format, which can
-- never match the new scId:centrifugeId:txHash:type:account ids — clear them
-- so the revived email path starts from an unambiguous ledger.
TRUNCATE "transaction_email_sent";--> statement-breakpoint
-- Hand-tuned: enum -> text has no automatic cast, so drizzle's bare SET DATA
-- TYPE would fail at apply time.
ALTER TABLE "transaction_email_sent" ALTER COLUMN "event_type" SET DATA TYPE text USING "event_type"::text;--> statement-breakpoint
DROP TYPE "public"."transaction_event_type";