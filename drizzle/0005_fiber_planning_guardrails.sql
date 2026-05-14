ALTER TYPE "public"."DocumentType" ADD VALUE IF NOT EXISTS 'PBOQ_SUMMARY_PROOF';--> statement-breakpoint
ALTER TYPE "public"."DocumentType" ADD VALUE IF NOT EXISTS 'PBOQ_BUILD_PROOF';--> statement-breakpoint
ALTER TYPE "public"."DocumentType" ADD VALUE IF NOT EXISTS 'PBOQ_MATERIAL_PROOF';--> statement-breakpoint
ALTER TYPE "public"."DocumentType" ADD VALUE IF NOT EXISTS 'PBOQ_WAYLEAVE_PROOF';--> statement-breakpoint
ALTER TABLE "PboqCostLine" RENAME COLUMN "labor" TO "build";