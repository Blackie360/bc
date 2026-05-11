ALTER TYPE "public"."DocumentType" ADD VALUE 'BC_TEMPLATE' BEFORE 'BUSINESS_CASE';--> statement-breakpoint
ALTER TYPE "public"."DocumentType" ADD VALUE 'ORDER_FORM' BEFORE 'BC_APPROVAL_CERTIFICATE';--> statement-breakpoint
ALTER TYPE "public"."DocumentType" ADD VALUE 'ACTUAL_SURVEY_QUOTE' BEFORE 'BC_APPROVAL_CERTIFICATE';--> statement-breakpoint
CREATE TABLE "BusinessCaseLink" (
	"id" text PRIMARY KEY NOT NULL,
	"businessCaseId" text NOT NULL,
	"linkName" text NOT NULL,
	"material" numeric(14, 2) NOT NULL,
	"labor" numeric(14, 2) NOT NULL,
	"wayleave" numeric(14, 2) NOT NULL,
	"mrr" numeric(14, 2) NOT NULL,
	"mrc" numeric(14, 2) NOT NULL,
	"nrc" numeric(14, 2) NOT NULL,
	"nrr" numeric(14, 2) NOT NULL,
	"evidenceDocumentId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "BusinessCase" ADD COLUMN "solutionArchitectureName" text DEFAULT 'Unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "BusinessCase" ADD COLUMN "solutionEngineerName" text DEFAULT 'Unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "BusinessCaseLink" ADD CONSTRAINT "BusinessCaseLink_businessCaseId_BusinessCase_id_fk" FOREIGN KEY ("businessCaseId") REFERENCES "public"."BusinessCase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BusinessCaseLink" ADD CONSTRAINT "BusinessCaseLink_evidenceDocumentId_Document_id_fk" FOREIGN KEY ("evidenceDocumentId") REFERENCES "public"."Document"("id") ON DELETE no action ON UPDATE no action;