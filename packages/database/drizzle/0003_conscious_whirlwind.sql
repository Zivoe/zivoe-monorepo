CREATE TYPE "public"."transaction_event_type" AS ENUM('deposit', 'redemption');--> statement-breakpoint
CREATE TABLE "transaction_email_sent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"tx_hash" text NOT NULL,
	"log_index" text NOT NULL,
	"user_id" uuid,
	"wallet_address" text NOT NULL,
	"event_type" "transaction_event_type" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transaction_email_sent_event_user_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "transaction_monitor_cursor" (
	"flow" "transaction_event_type" PRIMARY KEY NOT NULL,
	"last_block_number" bigint DEFAULT 0 NOT NULL,
	"last_log_index" integer DEFAULT -1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_email_sent" ADD CONSTRAINT "transaction_email_sent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_email_sent_event_idx" ON "transaction_email_sent" USING btree ("event_id");