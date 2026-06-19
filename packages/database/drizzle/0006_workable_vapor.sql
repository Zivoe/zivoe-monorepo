CREATE TABLE "daily_data" (
	"timestamp" timestamp with time zone PRIMARY KEY NOT NULL,
	"block_number" text NOT NULL,
	"index_price" double precision NOT NULL,
	"apy" double precision NOT NULL,
	"tvl" jsonb NOT NULL,
	"zstt_total_supply" text NOT NULL,
	"vault_total_assets" text NOT NULL,
	"loans_revenue" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safelist" (
	"wallet_address" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safelist_wallet_address_lowercase_check" CHECK ("wallet_address" = lower("wallet_address"))
);
