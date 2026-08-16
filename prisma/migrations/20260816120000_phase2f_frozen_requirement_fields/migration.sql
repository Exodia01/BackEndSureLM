-- Phase 2F: Add frozen-contract RequirementDefinition fields.
-- Hand-written, ADDITIVE migration. No DROP, TRUNCATE, data rewriting, or
-- destructive operations. Adds nullable columns only; preserves all existing
-- rows and workflow invariants.
--
-- Fields added per Content/SureLM_Business_Context_Contract.md §8:
--   documentType, category, isMandatory, displayOrder, onMaxAttemptsMessage
--
-- NOTE: surelm_0 was created via `prisma db push` and has no
-- `_prisma_migrations` history table. This migration is recorded for repo
-- history and the exact SQL below is applied directly to the DB by the
-- phase tooling. All new columns are nullable so the migration is safe on any
-- row state.

ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "documentType" TEXT;
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "isMandatory" BOOLEAN;
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER;
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "onMaxAttemptsMessage" TEXT;