-- Phase 4A: PolicyIssuance FK linkage (Application / Policy / PolicyVersion).
-- ADDITIVE forward migration only. No down migration.
-- Legacy PolicyIssuance rows keep NULL linkage columns. The Phase 4
-- application-issuance flow must populate all three and reference the
-- application's frozen policy/version.

-- AlterTable
ALTER TABLE "PolicyIssuance" ADD COLUMN "applicationId" TEXT;
ALTER TABLE "PolicyIssuance" ADD COLUMN "policyId" TEXT;
ALTER TABLE "PolicyIssuance" ADD COLUMN "policyVersionId" TEXT;

-- CreateIndex
CREATE INDEX "PolicyIssuance_applicationId_idx" ON "PolicyIssuance"("applicationId");

-- CreateIndex
CREATE INDEX "PolicyIssuance_policyId_idx" ON "PolicyIssuance"("policyId");

-- CreateIndex
CREATE INDEX "PolicyIssuance_policyVersionId_idx" ON "PolicyIssuance"("policyVersionId");

-- AddForeignKey
ALTER TABLE "PolicyIssuance" ADD CONSTRAINT "PolicyIssuance_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyIssuance" ADD CONSTRAINT "PolicyIssuance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyIssuance" ADD CONSTRAINT "PolicyIssuance_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
