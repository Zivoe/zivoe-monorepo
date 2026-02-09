CREATE TABLE "wallet_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address" text NOT NULL,
	"wallet_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_user_address" UNIQUE("user_id","address")
);
--> statement-breakpoint
CREATE TABLE "wallet_holdings" (
	"address" text PRIMARY KEY NOT NULL,
	"total_value_usd" numeric NOT NULL,
	"token_balance_usd" numeric NOT NULL,
	"defi_balance_usd" numeric NOT NULL,
	"holdings_updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "wallet_connection" ADD CONSTRAINT "wallet_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_connection_user_id_idx" ON "wallet_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_connection_address_idx" ON "wallet_connection" USING btree ("address");