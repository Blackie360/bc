CREATE TYPE "public"."PboqCostSource" AS ENUM('ACTUAL_SURVEY', 'PBOQ_ESTIMATE');--> statement-breakpoint
CREATE TABLE "PboqCostLine" (
	"id" text PRIMARY KEY NOT NULL,
	"pboqRequestId" text NOT NULL,
	"linkName" text NOT NULL,
	"material" numeric(14, 2) NOT NULL,
	"labor" numeric(14, 2) NOT NULL,
	"wayleave" numeric(14, 2) NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "mrr" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "nrr" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "contractTermMonths" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "PboqRequest" ADD COLUMN "surveyAvailable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "PboqRequest" ADD COLUMN "costSource" "PboqCostSource" DEFAULT 'PBOQ_ESTIMATE' NOT NULL;--> statement-breakpoint
ALTER TABLE "PboqRequest" ADD COLUMN "actualSurveyCost" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "PboqRequest" ADD COLUMN "fiberPlanningNotes" text;--> statement-breakpoint
ALTER TABLE "PboqCostLine" ADD CONSTRAINT "PboqCostLine_pboqRequestId_PboqRequest_id_fk" FOREIGN KEY ("pboqRequestId") REFERENCES "public"."PboqRequest"("id") ON DELETE no action ON UPDATE no action;
