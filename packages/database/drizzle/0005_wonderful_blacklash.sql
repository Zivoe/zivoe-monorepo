CREATE TABLE "user_email_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"product_tips_enabled" boolean DEFAULT true NOT NULL,
	"transaction_receipts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_email_preferences" ADD CONSTRAINT "user_email_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;