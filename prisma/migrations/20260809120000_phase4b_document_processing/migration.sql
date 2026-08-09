-- Phase 4B: Document processing foundation.
--   * Job/queue model (DocumentJob) with retries + backoff
--   * Per-stage audit trail (DocumentStageLog)
--   * Deterministic + AI-assisted validation outcome (DocumentValidationReport)
--   * CustomerDocument lifecycle columns (attempts, requirementRuleKey)
--   * Additive DocumentStatus lifecycle values (OCR_COMPLETE, EXTRACTED,
--     OCR_FAILED, EXTRACTION_FAILED, VALIDATION_FAILED, REVIEW_REQUIRED)
-- ADDITIVE forward migration only. No down migration.
-- Does NOT touch Keycloak or Phase 3/3.5/4A objects.
-- Safe on PG 16: ALTER TYPE ... ADD VALUE is allowed inside a transaction as
-- long as the new values are not referenced within the same transaction.

BEGIN;

-- CreateEnum: document pipeline stage (kept separate from DocumentStatus so
-- the document status reflects the outer lifecycle while the stage log
-- records fine-grained progress).
CREATE TYPE "DocumentStage" AS ENUM ('UPLOAD', 'NORMALIZE', 'OCR', 'CLASSIFY', 'EXTRACT', 'VALIDATE', 'REVIEW');

-- CreateEnum
CREATE TYPE "DocumentStageStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum: deterministic validation verdict. AI-assist may not downgrade a
-- PASS; REVIEW_REQUIRED is reserved for borderline/inferred outcomes.
CREATE TYPE "ValidationResult" AS ENUM ('PASS', 'FAIL', 'REVIEW_REQUIRED');

-- AlterEnum: add lifecycle states. PG16 allows ADD VALUE in a transaction.
ALTER TYPE "DocumentStatus" ADD VALUE 'OCR_COMPLETE';
ALTER TYPE "DocumentStatus" ADD VALUE 'EXTRACTED';
ALTER TYPE "DocumentStatus" ADD VALUE 'OCR_FAILED';
ALTER TYPE "DocumentStatus" ADD VALUE 'EXTRACTION_FAILED';
ALTER TYPE "DocumentStatus" ADD VALUE 'VALIDATION_FAILED';
ALTER TYPE "DocumentStatus" ADD VALUE 'REVIEW_REQUIRED';

-- AlterTable: lifecycle accounting on CustomerDocument.
ALTER TABLE "CustomerDocument" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CustomerDocument" ADD COLUMN "requirementRuleKey" TEXT;

-- CreateTable: one processing job per document (deduplicated by unique FK).
CREATE TABLE "DocumentJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'DOCUMENT_PROCESSING',
    "status" "DocumentJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable: per-stage audit trail for the document pipeline.
CREATE TABLE "DocumentStageLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "stage" "DocumentStage" NOT NULL,
    "status" "DocumentStageStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "confidence" DOUBLE PRECISION,
    "errorCode" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentStageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: validation outcome, deterministic first, AI-assist second.
CREATE TABLE "DocumentValidationReport" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "ValidationResult" NOT NULL,
    "deterministicPass" BOOLEAN,
    "ruleResults" JSONB NOT NULL,
    "discrepancies" JSONB NOT NULL,
    "aiAssist" JSONB,
    "docTypeDetected" "DocumentType",
    "docTypeConfidence" DOUBLE PRECISION,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: job queue scan by (status, availableAt) + the worker claim.
CREATE INDEX "DocumentJob_status_availableAt_idx" ON "DocumentJob"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentJob_documentId_key" ON "DocumentJob"("documentId");

-- CreateIndex: stage log time-series lookup.
CREATE INDEX "DocumentStageLog_documentId_stage_createdAt_idx" ON "DocumentStageLog"("documentId", "stage", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentValidationReport_documentId_key" ON "DocumentValidationReport"("documentId");

-- CreateIndex: document queue/status listing scans by (status, createdAt).
CREATE INDEX "CustomerDocument_status_createdAt_idx" ON "CustomerDocument"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentJob" ADD CONSTRAINT "DocumentJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CustomerDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStageLog" ADD CONSTRAINT "DocumentStageLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CustomerDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentValidationReport" ADD CONSTRAINT "DocumentValidationReport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CustomerDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: review attribution to a User (admin/agent). Nullable so
-- reports can be created before a reviewer is assigned. SET NULL on user delete.
ALTER TABLE "DocumentValidationReport" ADD CONSTRAINT "DocumentValidationReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
