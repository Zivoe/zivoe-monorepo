-- Organizations, and the Verification subject: a Verification and a Wallet link now belong to a subject (a person or
-- an organization), whose id Persona knows it by, instead of to a user. Written by hand around what drizzle-kit gives.
-- It moves no `kyc_verification` or `wallet_link` row and stops rather than guesses if there is one: those tables start
-- clean with Persona's production environment. Clear both right before applying it (TRUNCATE kyc_verification, wallet_link).
-- Every onboarded person becomes a subject, and everyone who onboarded as an organization becomes the first member of one.
-- Code from before it cannot read these tables: apply it and promote the code together.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "kyc_verification") OR EXISTS (SELECT 1 FROM "wallet_link") THEN
    RAISE EXCEPTION 'kyc_verification and wallet_link must be empty before migration 0021: see the note at its top';
  END IF;
END;
$$;--> statement-breakpoint
CREATE TYPE "public"."subject_kind" AS ENUM('individual', 'organization');--> statement-breakpoint
CREATE TYPE "public"."organization_invitation_cancel_reason" AS ENUM('member', 'inviter_removed', 'organization_deleted');--> statement-breakpoint
CREATE TYPE "public"."organization_invitation_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country_of_incorporation" text,
	"created_by_user_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "verification_subject" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "subject_kind" NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_subject_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "verification_subject_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "verification_subject_is_who_it_says" CHECK (("verification_subject"."kind" = 'individual' AND "verification_subject"."user_id" IS NOT NULL AND "verification_subject"."user_id" = "verification_subject"."id" AND "verification_subject"."organization_id" IS NULL) OR ("verification_subject"."kind" = 'organization' AND "verification_subject"."organization_id" IS NOT NULL AND "verification_subject"."organization_id" = "verification_subject"."id" AND "verification_subject"."user_id" IS NULL))
);--> statement-breakpoint
ALTER TABLE "verification_subject" ADD CONSTRAINT "verification_subject_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_subject" ADD CONSTRAINT "verification_subject_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "organization_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"invitation_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_member_org_user_unique" UNIQUE("organization_id","user_id")
);--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_member_user_id_idx" ON "organization_member" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE "organization_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by_user_id" uuid,
	"status" "organization_invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL,
	"send_count" integer DEFAULT 1 NOT NULL,
	"responded_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancel_reason" "organization_invitation_cancel_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invitation_email_lowercase" CHECK ("organization_invitation"."email" = lower("organization_invitation"."email"))
);--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_cancelled_by_user_id_user_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_invitation_pending_uidx" ON "organization_invitation" USING btree ("organization_id","email") WHERE "organization_invitation"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "organization_invitation_email_idx" ON "organization_invitation" USING btree ("email","status");--> statement-breakpoint
CREATE INDEX "organization_invitation_org_status_idx" ON "organization_invitation" USING btree ("organization_id","status");--> statement-breakpoint
-- Held to the end: a profile written between the backfill and the column drops would get no subject, and an
-- organization's would lose its name. The drops below take this same lock anyway.
LOCK TABLE "profile" IN ACCESS EXCLUSIVE MODE;--> statement-breakpoint
-- Everyone onboarded is a subject.
INSERT INTO "verification_subject" ("id", "kind", "user_id")
SELECT "id", 'individual', "id" FROM "profile"--> statement-breakpoint
-- Everyone who onboarded as an organization: one organization each, with them as its first member. Matched back to
-- its creator below, since each such profile makes exactly one.
INSERT INTO "organization" ("name", "country_of_incorporation", "created_by_user_id", "created_at")
SELECT coalesce(nullif(btrim("entity_name"), ''), "first_name" || ' ' || "last_name"), "country_of_incorporation", "id", "created_at"
FROM "profile" WHERE "account_type" = 'organization'--> statement-breakpoint
INSERT INTO "organization_member" ("organization_id", "user_id", "title", "joined_at")
SELECT o."id", p."id", p."job_title", p."created_at"
FROM "organization" o JOIN "profile" p ON p."id" = o."created_by_user_id"--> statement-breakpoint
INSERT INTO "verification_subject" ("id", "kind", "organization_id")
SELECT "id", 'organization', "id" FROM "organization"--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "account_type"--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "job_title"--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "entity_name"--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "country_of_incorporation"--> statement-breakpoint
DROP TYPE "public"."account_type"--> statement-breakpoint
-- Empty (checked above), so the keys are replaced rather than converted.
ALTER TABLE "kyc_verification" DROP COLUMN "user_id"--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN "subject_id" uuid PRIMARY KEY NOT NULL--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN "started_by_user_id" uuid--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD CONSTRAINT "kyc_verification_subject_id_verification_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."verification_subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD CONSTRAINT "kyc_verification_started_by_user_id_user_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP INDEX "wallet_link_pending_user_address_uidx"--> statement-breakpoint
DROP INDEX "wallet_link_user_id_idx"--> statement-breakpoint
ALTER TABLE "wallet_link" DROP CONSTRAINT "wallet_link_linked_has_signature"--> statement-breakpoint
ALTER TABLE "wallet_link" DROP COLUMN "user_id"--> statement-breakpoint
ALTER TABLE "wallet_link" ADD COLUMN "subject_id" uuid NOT NULL--> statement-breakpoint
ALTER TABLE "wallet_link" ADD COLUMN "signed_by_user_id" uuid--> statement-breakpoint
ALTER TABLE "wallet_link" ADD CONSTRAINT "wallet_link_subject_id_verification_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."verification_subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_link" ADD CONSTRAINT "wallet_link_signed_by_user_id_user_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_link_subject_id_idx" ON "wallet_link" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_link_pending_subject_address_uidx" ON "wallet_link" USING btree ("subject_id","address") WHERE "wallet_link"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "wallet_link" ADD CONSTRAINT "wallet_link_linked_has_signature" CHECK ("wallet_link"."status" = 'pending' OR ("wallet_link"."signature" IS NOT NULL AND "wallet_link"."signed_at" IS NOT NULL AND "wallet_link"."signed_by_user_id" IS NOT NULL))--> statement-breakpoint
-- The signed-link guard from 0020, now over the subject and the signer: a linked row keeps both. Deleting a person
-- who owns or signed one is refused all the same, through the cascade and the foreign key's SET NULL.
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
    NEW."signature", NEW."signed_at", NEW."issued_at", NEW."expires_at"
  ) IS DISTINCT FROM (
    OLD."status", OLD."subject_id", OLD."signed_by_user_id", OLD."address", OLD."chain_id", OLD."nonce", OLD."typed_data",
    OLD."signature", OLD."signed_at", OLD."issued_at", OLD."expires_at"
  ) THEN
    RAISE EXCEPTION 'wallet_link %: a signed link keeps its status, owner, signer, address and proof', OLD."id"
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$
