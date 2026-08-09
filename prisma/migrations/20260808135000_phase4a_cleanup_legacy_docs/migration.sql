-- Phase 4A cleanup: drop the obsolete (orphaned) legacy document-subsystem objects.
--
-- Proven obsolete by destructive-cleanup audit (2026-08-09):
--   * All 12 legacy tables contain 0 rows (verified live).
--   * No production code references them: current prisma/schema.prisma has no
--     models for these tables; they exist only in the historical init migration.
--   * No current Prisma model has an FK pointing into any legacy table.
--     (FKs from legacy tables -> PolicyLead/User/Document live ON the legacy
--     tables and are dropped with them.)
--   * No views, triggers, or functions reference legacy tables.
--   * Enum usages: the legacy-only enums below are used ONLY by legacy tables,
--     except UploadStatus which is additionally used by the legacy column
--     Document.scanStatus (dropped below) and DocumentType which is recreated
--     with Phase 4A values in 20260808140000_phase4a_application.
--   * Keycloak tables share this database but are NOT touched (no Keycloak
--     object is referenced by or referenced from any statement here).
--
-- Forward-safe: DROP-only statements, idempotent (IF EXISTS), ordered children-first.

-- 1) Leaf-level legacy tables (reference other legacy tables only):
DROP TABLE IF EXISTS "ValidationLog";
DROP TABLE IF EXISTS "ValidationReport";
DROP TABLE IF EXISTS "ChecklistItemInstance";
DROP TABLE IF EXISTS "DocumentScan";
DROP TABLE IF EXISTS "AuditTrail";
DROP TABLE IF EXISTS "RequirementCompilerReport";

-- 2) Mid-level legacy tables:
DROP TABLE IF EXISTS "ChecklistInstance";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "AuthRateLimitLog";

-- 3) Base legacy tables:
DROP TABLE IF EXISTS "RequirementItem";
DROP TABLE IF EXISTS "RequirementTemplate";
DROP TABLE IF EXISTS "Product";

-- 4) Legacy columns on the CURRENT Document table (not present in the current
--    Prisma model Document): scanStatus (UploadStatus enum), uploadedById (FK
--    to User), householdId. Drop the FK constraint first, then the columns.
ALTER TABLE "Document" DROP CONSTRAINT IF EXISTS "Document_uploadedById_fkey";
ALTER TABLE "Document" DROP COLUMN IF EXISTS "scanStatus";
ALTER TABLE "Document" DROP COLUMN IF EXISTS "uploadedById";
ALTER TABLE "Document" DROP COLUMN IF EXISTS "householdId";

-- 5) Legacy-only enums. DocumentType is recreated with Phase 4A values by the
--    subsequent phase4a_application migration (timestamp 140000 > 135000).
DROP TYPE IF EXISTS "DocumentType";      -- legacy KYC_* enum
DROP TYPE IF EXISTS "UploadStatus";
DROP TYPE IF EXISTS "ChecklistStatus";
DROP TYPE IF EXISTS "ValidationStage";
DROP TYPE IF EXISTS "ValidationStatus";
DROP TYPE IF EXISTS "ProductType";
