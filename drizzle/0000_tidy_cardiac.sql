CREATE TYPE "public"."ApprovalAction" AS ENUM('SUBMIT', 'APPROVE', 'REJECT', 'REVERT', 'ESCALATE', 'VALIDATE', 'REQUEST_REVISION', 'CAPTURE_ACTUALS', 'GENERATE_CERTIFICATE');--> statement-breakpoint
CREATE TYPE "public"."BusinessCaseType" AS ENUM('ORDINARY_BC', 'MARGIN_ANALYSIS_BC');--> statement-breakpoint
CREATE TYPE "public"."DecisionOutput" AS ENUM('PROCEED', 'SEEK_FINANCE_APPROVAL', 'PROCEED_WITH_SUBSIDY_DISCLOSURE');--> statement-breakpoint
CREATE TYPE "public"."DocumentType" AS ENUM('SOLUTION_DESIGN', 'PBOQ', 'BUSINESS_CASE', 'SITE_ACQUISITION', 'SURVEY_REPORT', 'CONTRACTOR_QUOTE', 'BC_APPROVAL_CERTIFICATE', 'ACTUAL_COST_EVIDENCE');--> statement-breakpoint
CREATE TYPE "public"."OpportunityStatus" AS ENUM('OPPORTUNITY_CREATED', 'PBOQ_REQUESTED', 'FIBER_PLANNING_COSTS', 'BUSINESS_CASE_PREPARED', 'FINANCIAL_METRICS_COMPUTED', 'APPROVAL_ROUTING', 'FINANCE_CFO_APPROVAL', 'SALES_OPERATIONS_VALIDATION', 'SDU_VALIDATION', 'SURVEY_SITE_ACQUISITION', 'CONTRACTOR_IMPLEMENTATION', 'ACTUAL_COST_CAPTURE', 'BUDGET_ACTUAL_ANALYSIS', 'PROJECT_CLOSURE_REPORTING', 'REVERTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('ACCOUNT_MANAGER', 'FIBER_PLANNING', 'BC_ANALYST', 'CFO', 'SALES_OPERATIONS', 'SDU', 'SITE_ACQUISITION_MANAGER', 'PROJECT_MANAGER', 'CONTRACTOR');--> statement-breakpoint
CREATE TABLE "ActualCostCapture" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunityId" text NOT NULL,
	"businessCaseId" text NOT NULL,
	"contractorName" text,
	"approvedBudget" numeric(14, 2) NOT NULL,
	"actualSpend" numeric(14, 2) NOT NULL,
	"surveyBudget" numeric(14, 2) NOT NULL,
	"surveyActual" numeric(14, 2) NOT NULL,
	"varianceAmount" numeric(14, 2) NOT NULL,
	"variancePercent" numeric(8, 2) NOT NULL,
	"surveyDeviationPct" numeric(8, 2) NOT NULL,
	"capturedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ApprovalCertificate" (
	"id" text PRIMARY KEY NOT NULL,
	"businessCaseId" text NOT NULL,
	"certificateNo" text NOT NULL,
	"issuedAt" timestamp DEFAULT now() NOT NULL,
	"fileStorageKey" text NOT NULL,
	"checksum" text NOT NULL,
	CONSTRAINT "ApprovalCertificate_businessCaseId_unique" UNIQUE("businessCaseId"),
	CONSTRAINT "ApprovalCertificate_certificateNo_unique" UNIQUE("certificateNo")
);
--> statement-breakpoint
CREATE TABLE "ApprovalHistory" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunityId" text NOT NULL,
	"businessCaseId" text,
	"actorId" text NOT NULL,
	"role" "UserRole" NOT NULL,
	"action" "ApprovalAction" NOT NULL,
	"fromStatus" "OpportunityStatus",
	"toStatus" "OpportunityStatus",
	"decision" "DecisionOutput",
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "AuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunityId" text,
	"actorId" text,
	"event" text NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BusinessCase" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunityId" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"type" "BusinessCaseType" NOT NULL,
	"irr" numeric(8, 2) NOT NULL,
	"paybackMonths" integer NOT NULL,
	"capex" numeric(14, 2) NOT NULL,
	"subsidyRequirement" numeric(14, 2) NOT NULL,
	"approvedBudget" numeric(14, 2) NOT NULL,
	"grossMarginPercent" numeric(8, 2),
	"decisionOutput" "DecisionOutput" NOT NULL,
	"requiresCfo" boolean DEFAULT false NOT NULL,
	"subsidyDisclosed" boolean DEFAULT false NOT NULL,
	"submittedAt" timestamp,
	"approvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "BusinessCase_opportunityId_version_unique" UNIQUE("opportunityId","version")
);
--> statement-breakpoint
CREATE TABLE "Document" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunityId" text NOT NULL,
	"uploadedById" text NOT NULL,
	"type" "DocumentType" NOT NULL,
	"name" text NOT NULL,
	"storageKey" text NOT NULL,
	"mimeType" text NOT NULL,
	"sizeBytes" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Opportunity" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"customerName" text NOT NULL,
	"opportunityName" text NOT NULL,
	"region" text NOT NULL,
	"segment" text NOT NULL,
	"accountManagerId" text NOT NULL,
	"status" "OpportunityStatus" DEFAULT 'OPPORTUNITY_CREATED' NOT NULL,
	"priority" text DEFAULT 'Normal' NOT NULL,
	"requestedDate" timestamp DEFAULT now() NOT NULL,
	"targetInstallDate" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Opportunity_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "PboqRequest" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunityId" text NOT NULL,
	"solutionDesignDocumentId" text,
	"siteCount" integer NOT NULL,
	"routeDistanceKm" numeric(10, 2) NOT NULL,
	"surveyBudget" numeric(14, 2) NOT NULL,
	"notes" text,
	"requestedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	CONSTRAINT "PboqRequest_opportunityId_unique" UNIQUE("opportunityId")
);
--> statement-breakpoint
CREATE TABLE "Revision" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunityId" text NOT NULL,
	"businessCaseId" text,
	"requestedById" text NOT NULL,
	"reason" text NOT NULL,
	"notes" text NOT NULL,
	"revisionNumber" integer NOT NULL,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "UserRole" NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "WorkflowAssignment" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunityId" text NOT NULL,
	"role" "UserRole" NOT NULL,
	"assigneeId" text,
	"status" "OpportunityStatus" NOT NULL,
	"dueAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ActualCostCapture" ADD CONSTRAINT "ActualCostCapture_opportunityId_Opportunity_id_fk" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ActualCostCapture" ADD CONSTRAINT "ActualCostCapture_businessCaseId_BusinessCase_id_fk" FOREIGN KEY ("businessCaseId") REFERENCES "public"."BusinessCase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ApprovalCertificate" ADD CONSTRAINT "ApprovalCertificate_businessCaseId_BusinessCase_id_fk" FOREIGN KEY ("businessCaseId") REFERENCES "public"."BusinessCase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_opportunityId_Opportunity_id_fk" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_businessCaseId_BusinessCase_id_fk" FOREIGN KEY ("businessCaseId") REFERENCES "public"."BusinessCase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_actorId_User_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_opportunityId_Opportunity_id_fk" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_User_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "BusinessCase" ADD CONSTRAINT "BusinessCase_opportunityId_Opportunity_id_fk" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_opportunityId_Opportunity_id_fk" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_User_id_fk" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_accountManagerId_User_id_fk" FOREIGN KEY ("accountManagerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "PboqRequest" ADD CONSTRAINT "PboqRequest_opportunityId_Opportunity_id_fk" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_opportunityId_Opportunity_id_fk" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_businessCaseId_BusinessCase_id_fk" FOREIGN KEY ("businessCaseId") REFERENCES "public"."BusinessCase"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_requestedById_User_id_fk" FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorkflowAssignment" ADD CONSTRAINT "WorkflowAssignment_opportunityId_Opportunity_id_fk" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorkflowAssignment" ADD CONSTRAINT "WorkflowAssignment_assigneeId_User_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;