-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('KYC_AADHAAR_FRONT', 'KYC_AADHAAR_BACK', 'KYC_PAN');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'VALIDATED', 'REJECTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "DocumentScan" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "docType" "DocumentType",
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "originalHash" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "ocrData" JSONB,
    "extractedData" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentScan_leadId_status_idx" ON "DocumentScan"("leadId", "status");

-- AddForeignKey
ALTER TABLE "DocumentScan" ADD CONSTRAINT "DocumentScan_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PolicyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
