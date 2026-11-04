ALTER TABLE "kyc_verification" ADD COLUMN "persona_case_id" text;--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN "persona_case_status" text;--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_verification_persona_inquiry_id_uidx" ON "kyc_verification" USING btree ("persona_inquiry_id") WHERE "kyc_verification"."persona_inquiry_id" is not null;