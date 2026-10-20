CREATE TYPE "public"."wallet_link_status" AS ENUM('pending', 'linked', 'removed');--> statement-breakpoint
CREATE TABLE "wallet_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address" text NOT NULL,
	"wallet_type" text,
	"wallet_name" text,
	"chain_id" integer NOT NULL,
	"status" "wallet_link_status" NOT NULL,
	"nonce" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"typed_data" jsonb NOT NULL,
	"signature" text,
	"signed_at" timestamp with time zone,
	"whitelist_requested_at" timestamp with time zone,
	"whitelist_observed_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_link_address_lowercase_check" CHECK ("wallet_link"."address" = lower("wallet_link"."address"))
);
--> statement-breakpoint
ALTER TABLE "wallet_link" ADD CONSTRAINT "wallet_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_link_user_id_idx" ON "wallet_link" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_link_linked_user_address_uidx" ON "wallet_link" USING btree ("user_id","address") WHERE "wallet_link"."status" = 'linked';--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_link_pending_user_address_uidx" ON "wallet_link" USING btree ("user_id","address") WHERE "wallet_link"."status" = 'pending';