-- Phase 3 hardening: guarantee at most one current PolicyVersion per policy.
-- Partial unique index: a policy can have exactly one row with is_current = true.
-- This is the database-level guarantee that concurrent version publishing can
-- never leave two "current" versions. Complemented by the existing
-- UNIQUE("policyId", "versionNum") constraint.
CREATE UNIQUE INDEX IF NOT EXISTS "PolicyVersion_policyId_current_key"
  ON "PolicyVersion"("policyId")
  WHERE "isCurrent";
