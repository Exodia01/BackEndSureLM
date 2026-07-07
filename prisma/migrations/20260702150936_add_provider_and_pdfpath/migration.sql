-- CreateEnum
CREATE TYPE "BrochureStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "BrochureAction" AS ENUM ('UPLOAD', 'VERSION_CREATED', 'PROCESS_START', 'PROCESS_COMPLETE', 'FAILED');

-- AlterTable
ALTER TABLE "Chunk" ADD COLUMN     "brochureId" TEXT,
ALTER COLUMN "documentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Brochure" (
    "id" TEXT NOT NULL,
    "basename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "pdfData" BYTEA NOT NULL,
    "currentPage" INTEGER NOT NULL DEFAULT 0,
    "totalPages" INTEGER NOT NULL,
    "status" "BrochureStatus" NOT NULL DEFAULT 'PENDING',
    "versionHash" TEXT,
    "versionNum" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brochure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrochureLog" (
    "id" TEXT NOT NULL,
    "brochureId" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL,
    "action" "BrochureAction" NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrochureLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chunk_brochureId_chunkOrder_idx" ON "Chunk"("brochureId", "chunkOrder");

-- AddForeignKey
ALTER TABLE "BrochureLog" ADD CONSTRAINT "BrochureLog_brochureId_fkey" FOREIGN KEY ("brochureId") REFERENCES "Brochure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_brochureId_fkey" FOREIGN KEY ("brochureId") REFERENCES "Brochure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
