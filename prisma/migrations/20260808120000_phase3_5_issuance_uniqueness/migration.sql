-- Phase 3.5: Harden policy issuance with DB-level uniqueness and audit trail
-- 1. Add issuedBy column for audit trail
-- 2. Add unique constraint on (leadId, policyName) to prevent duplicate issuances
-- 3. Dedupe any existing duplicates (keep earliest by createdAt)

-- Add issuedBy column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PolicyIssuance' AND column_name = 'issuedBy'
  ) THEN
    ALTER TABLE "PolicyIssuance" ADD COLUMN "issuedBy" TEXT;
  END IF;
END $$;

-- Dedupe existing issuances: keep the earliest per (leadId, policyName)
DELETE FROM "PolicyIssuance" a
USING "PolicyIssuance" b
WHERE a."createdAt" > b."createdAt"
  AND a."leadId" = b."leadId"
  AND a."policyName" = b."policyName";

-- Create unique index on (leadId, policyName)
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyIssuance_leadId_policyName_key"
  ON "PolicyIssuance"("leadId", "policyName");