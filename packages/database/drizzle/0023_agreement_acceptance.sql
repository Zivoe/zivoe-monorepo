CREATE TABLE "agreement_acceptance" (
	"subject_id" uuid PRIMARY KEY NOT NULL,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agreement_acceptance" ADD CONSTRAINT "agreement_acceptance_subject_id_verification_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."verification_subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptance" ADD CONSTRAINT "agreement_acceptance_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;