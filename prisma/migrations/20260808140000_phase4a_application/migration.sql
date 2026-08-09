-- Phase 4A: Application, CustomerDocument, AuditEvent foundation.
-- ADDITIVE forward migration only. No down migration.
-- Rollback strategy (operational, not a schema revert):
--   * New tables (Application, CustomerDocument, AuditEvent) can be dropped
--     only after all dependent application-issuance rows have been re-homed.
--   * PolicyIssuance linkage columns remain NULL for legacy rows.
--   * No existing table is altered destructively.

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR', 'PAN', 'BANK_STATEMENT', 'INCOME_PROOF', 'ADDRESS_PROOF', 'IDENTITY_PROOF', 'POLICY_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'VALIDATED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDERWRITING', 'DOCUMENTS_REQUIRED', 'APPROVED', 'ISSUED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "docType" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "originalFilename" TEXT NOT NULL,
    "originalHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "pageCount" INTEGER,
    "ocrData" JSONB,
    "extractedData" JSONB,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Application_leadId_idx" ON "Application"("leadId");

-- CreateIndex
CREATE INDEX "Application_policyId_idx" ON "Application"("policyId");

-- CreateIndex
CREATE INDEX "Application_policyVersionId_idx" ON "Application"("policyVersionId");

-- CreateIndex
CREATE INDEX "Application_leadId_status_createdAt_idx" ON "Application"("leadId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerDocument_applicationId_docType_idx" ON "CustomerDocument"("applicationId", "docType");

-- CreateIndex
CREATE INDEX "CustomerDocument_originalHash_idx" ON "CustomerDocument"("originalHash");

-- CreateIndex
CREATE INDEX "CustomerDocument_uploadedById_idx" ON "CustomerDocument"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDocument_applicationId_originalHash_key" ON "CustomerDocument"("applicationId", "originalHash");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PolicyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 4A uniqueness: at most one ACTIVE application per (lead, policy,
-- version). Terminal states (ISSUED/REJECTED/WITHDRAWN) drop out of the index
-- so a later application for the same triple is permitted.
-- Prisma cannot express partial indexes; this is the equivalent of the
-- Phase 3 B1 pattern (PolicyVersion single-current index).
CREATE UNIQUE INDEX "Application_active_lead_policy_version_key"
  ON "Application"("leadId", "policyId", "policyVersionId")
  WHERE "status" NOT IN ('ISSUED', 'REJECTED', 'WITHDRAWN');
