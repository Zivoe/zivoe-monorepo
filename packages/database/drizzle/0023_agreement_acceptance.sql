CREATE TABLE "agreement_acceptance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"agreements_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallet_link" ADD COLUMN "agreements_version" text;--> statement-breakpoint
ALTER TABLE "agreement_acceptance" ADD CONSTRAINT "agreement_acceptance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_acceptance_user_version_idx" ON "agreement_acceptance" USING btree ("user_id","agreements_version");--> statement-breakpoint
-- 0021 starts wallet_link empty and nothing in production links before this: only a local database that linked under
-- an earlier draft of 0023 has a row to refuse here, and clears wallet_link first.
ALTER TABLE "wallet_link" ADD CONSTRAINT "wallet_link_linked_has_agreements_version" CHECK ("wallet_link"."status" = 'pending' OR "wallet_link"."agreements_version" IS NOT NULL);--> statement-breakpoint
-- The signed-link guard from 0021, now over the agreements version too: a linked row keeps the version it was made under.
CREATE OR REPLACE FUNCTION "wallet_link_guard_signed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'linked' THEN
      RAISE EXCEPTION 'wallet_link %: a signed link is never deleted', OLD."id" USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'linked' AND (
    NEW."status", NEW."subject_id", NEW."signed_by_user_id", NEW."address", NEW."chain_id", NEW."nonce", NEW."typed_data",
    NEW."signature", NEW."signed_at", NEW."issued_at", NEW."expires_at", NEW."agreements_version"
  ) IS DISTINCT FROM (
    OLD."status", OLD."subject_id", OLD."signed_by_user_id", OLD."address", OLD."chain_id", OLD."nonce", OLD."typed_data",
    OLD."signature", OLD."signed_at", OLD."issued_at", OLD."expires_at", OLD."agreements_version"
  ) THEN
    RAISE EXCEPTION 'wallet_link %: a signed link keeps its status, owner, signer, address, proof and agreements version', OLD."id"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
