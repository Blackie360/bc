CREATE TYPE "public"."RequiredService" AS ENUM('EPL', 'DIA', 'DFA');--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "siteName" text;--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "siteCoordinates" text;--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "requiredService" "RequiredService";--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "capacity" text;--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "salesRequestor" text;--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "leadNetworkPlanner" text;--> statement-breakpoint
ALTER TABLE "Opportunity" ADD COLUMN "designPlanDate" timestamp;