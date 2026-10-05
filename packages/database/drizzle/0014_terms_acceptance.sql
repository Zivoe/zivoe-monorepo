CREATE TABLE "app_config" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"terms_updated_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_config_singleton_check" CHECK ("app_config"."id")
);
--> statement-breakpoint
CREATE TABLE "terms_acceptance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "terms_acceptance" ADD CONSTRAINT "terms_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "terms_acceptance_user_accepted_idx" ON "terms_acceptance" USING btree ("user_id","accepted_at");--> statement-breakpoint
-- The one config row. Nobody has an acceptance yet, so every user is asked to accept on their next page load.
INSERT INTO "app_config" ("terms_updated_at") VALUES (now());
