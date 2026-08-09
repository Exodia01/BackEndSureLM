-- Phase 2 (Silo 1): Policy/Brochure ingestion architecture
-- Hand-written migration. Applied additively; does NOT touch Silo 2 tables.
-- NOTE: Brochure.pdfData is intentionally kept (made nullable) so that
-- scripts/migrate-brochure-pdfs.ts can move existing BYTEA blobs to disk.
-- After that script verifies all rows have filePath, a follow-up migration
-- drops pdfData and enforces NOT NULL on filePath.

-- Extend BrochureStatus enum with ARCHIVED (used for superseded brochure versions).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ARCHIVED'
                 AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'BrochureStatus')) THEN
    ALTER TYPE "BrochureStatus" ADD VALUE 'ARCHIVED';
  END IF;
END $$;

-- Add filePath and relax pdfData while the filesystem migration runs.
ALTER TABLE "Brochure" ADD COLUMN IF NOT EXISTS "filePath" TEXT;
ALTER TABLE "Brochure" ALTER COLUMN "pdfData" DROP NOT NULL;

-- CreateEnum
CREATE TYPE "ExtractionMode" AS ENUM ('EXPLICIT', 'INFERRED', 'UNCERTAIN');

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "category" TEXT,
    "allowReuse" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentVersionId" TEXT,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyBrochure" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "brochureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyBrochure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL,
    "label" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementDefinition" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "brochureId" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "ruleKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "extractionMode" "ExtractionMode" NOT NULL,
    "validationRules" JSONB,
    "provenance" JSONB,
    "sourceChunkIds" TEXT[],
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementSnapshot" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RequirementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Policy_name_idx" ON "Policy"("name");

-- CreateIndex
CREATE INDEX "Policy_isActive_idx" ON "Policy"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_currentVersionId_key" ON "Policy"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyBrochure_policyId_brochureId_key" ON "PolicyBrochure"("policyId", "brochureId");

-- CreateIndex
CREATE INDEX "PolicyBrochure_brochureId_idx" ON "PolicyBrochure"("brochureId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_policyId_versionNum_key" ON "PolicyVersion"("policyId", "versionNum");

-- CreateIndex
CREATE INDEX "PolicyVersion_policyId_isCurrent_idx" ON "PolicyVersion"("policyId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementDefinition_policyId_ruleKey_isDraft_key" ON "RequirementDefinition"("policyId", "ruleKey", "isDraft");

-- CreateIndex
CREATE INDEX "RequirementDefinition_brochureId_idx" ON "RequirementDefinition"("brochureId");

-- CreateIndex
CREATE INDEX "RequirementDefinition_isDraft_idx" ON "RequirementDefinition"("isDraft");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementSnapshot_policyVersionId_key" ON "RequirementSnapshot"("policyVersionId");

-- CreateIndex
CREATE INDEX "RequirementSnapshot_policyId_idx" ON "RequirementSnapshot"("policyId");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyBrochure" ADD CONSTRAINT "PolicyBrochure_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyBrochure" ADD CONSTRAINT "PolicyBrochure_brochureId_fkey" FOREIGN KEY ("brochureId") REFERENCES "Brochure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementDefinition" ADD CONSTRAINT "RequirementDefinition_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementDefinition" ADD CONSTRAINT "RequirementDefinition_brochureId_fkey" FOREIGN KEY ("brochureId") REFERENCES "Brochure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSnapshot" ADD CONSTRAINT "RequirementSnapshot_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSnapshot" ADD CONSTRAINT "RequirementSnapshot_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
