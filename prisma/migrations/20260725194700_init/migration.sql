-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FOLLOWUP', 'BIRTHDAY');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('AGENT', 'AI');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('AGENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'POLICY_ISSUED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IssuanceStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('KYC_AADHAAR_FRONT', 'KYC_AADHAAR_BACK', 'KYC_PAN', 'KYC_ADDRESS', 'KYC_BANK_STATEMENT', 'KYC_INCOME_PROOF');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'VALIDATED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'VALIDATED', 'SKIPPED', 'FAILED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "BrochureStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "BrochureAction" AS ENUM ('UPLOAD', 'VERSION_CREATED', 'PROCESS_START', 'PROCESS_COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "ValidationStage" AS ENUM ('OCR_COMPLETED', 'EXTRACTION_COMPLETED', 'RULE_VALIDATED', 'AI_VERIFICATION');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('TERM_INSURANCE', 'ENDOWMENT_PLANS', 'MONEYBACK_PLANS', 'ULIP', 'PENSION_PLANS', 'HEALTH_INSURANCE', 'MICRO_INSURANCE', 'SINGLE_PREMIUM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "keycloakId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankCustomerId" TEXT,
    "location" TEXT,
    "language" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyLead" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "householdName" TEXT NOT NULL,
    "phone" TEXT,
    "income" INTEGER,
    "familySize" INTEGER,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),

    CONSTRAINT "PolicyLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyIssuance" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "policyProvider" TEXT,
    "premiumAmount" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "IssuanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nextPremiumDue" TIMESTAMP(3),

    CONSTRAINT "PolicyIssuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "policies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayReminder" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "daysUntil" INTEGER NOT NULL,
    "isToday" BOOLEAN NOT NULL DEFAULT false,
    "wishSent" BOOLEAN NOT NULL DEFAULT false,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BirthdayReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "source" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scanStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "householdId" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "brochureId" TEXT,
    "content" TEXT NOT NULL,
    "chunkOrder" INTEGER NOT NULL,
    "pageNumber" INTEGER,
    "category" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "scanId" TEXT,
    "stage" "ValidationStage" NOT NULL,
    "status" "ValidationStatus" NOT NULL,
    "errorMsg" TEXT,
    "configuration" JSONB,
    "results" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationLog" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "intermediate_results" JSONB,
    "final_output" JSONB,
    "agents_executed" JSONB NOT NULL,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OrchestrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrchestrationAgentLog" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input_data" JSONB,
    "output_data" JSONB,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrchestrationAgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementTemplate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceFile" TEXT,
    "compiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compilerVersion" TEXT NOT NULL,

    CONSTRAINT "RequirementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupLabel" TEXT NOT NULL,
    "groupOrder" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "docType" "DocumentType" NOT NULL,
    "label" TEXT NOT NULL,
    "isPreferred" BOOLEAN DEFAULT false,
    "itemOrder" INTEGER NOT NULL,
    "ruleSet" JSONB,
    "selectionPolicy" TEXT NOT NULL DEFAULT 'ONE_OF',
    "minRequired" INTEGER NOT NULL DEFAULT 1,
    "maxAllowed" INTEGER,

    CONSTRAINT "RequirementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementCompilerReport" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "parseWarnings" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "unknownDocumentTypes" TEXT[],
    "itemsExtracted" INTEGER NOT NULL,
    "groupsFound" INTEGER NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "compiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementCompilerReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistInstance" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "applicationData" JSONB,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "overallStatus" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "invalidatedReason" TEXT,
    "productId" TEXT,

    CONSTRAINT "ChecklistInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItemInstance" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedDocId" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "completionNotes" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipReason" TEXT,
    "ruleErrors" JSONB,

    CONSTRAINT "ChecklistItemInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentScan" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "templateId" TEXT,
    "itemId" TEXT,
    "docType" "DocumentType",
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "originalHash" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimetype" TEXT,
    "sizeBytes" INTEGER,
    "ocrData" JSONB,
    "extractedData" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "requirementItemId" TEXT,

    CONSTRAINT "DocumentScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationReport" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "scanId" TEXT,
    "rulesPassed" INTEGER NOT NULL,
    "rulesFailed" INTEGER NOT NULL,
    "aiConfidence" DOUBLE PRECISION,
    "agentVerified" BOOLEAN,
    "validatedAt" TIMESTAMP(3),
    "validatedBy" TEXT,
    "errors" JSONB,
    "warnings" JSONB,
    "overallStatus" "UploadStatus" DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION,
    "extractedData" JSONB,
    "discrepancies" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTrail" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keycloakUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "state" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRateLimitLog" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthRateLimitLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_keycloakId_key" ON "User"("keycloakId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AgentProfile_userId_key" ON "AgentProfile"("userId");

-- CreateIndex
CREATE INDEX "PolicyLead_agentId_status_followUpAt_idx" ON "PolicyLead"("agentId", "status", "followUpAt");

-- CreateIndex
CREATE INDEX "PolicyLead_status_idx" ON "PolicyLead"("status");

-- CreateIndex
CREATE INDEX "PolicyLead_followUpAt_idx" ON "PolicyLead"("followUpAt");

-- CreateIndex
CREATE INDEX "PolicyLead_agentId_createdAt_idx" ON "PolicyLead"("agentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyLead_agentId_phone_key" ON "PolicyLead"("agentId", "phone");

-- CreateIndex
CREATE INDEX "PolicyIssuance_leadId_idx" ON "PolicyIssuance"("leadId");

-- CreateIndex
CREATE INDEX "Message_leadId_createdAt_idx" ON "Message"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Reminder_leadId_idx" ON "Reminder"("leadId");

-- CreateIndex
CREATE INDEX "Reminder_scheduledAt_idx" ON "Reminder"("scheduledAt");

-- CreateIndex
CREATE INDEX "BirthdayReminder_leadId_idx" ON "BirthdayReminder"("leadId");

-- CreateIndex
CREATE INDEX "Chunk_documentId_chunkOrder_idx" ON "Chunk"("documentId", "chunkOrder");

-- CreateIndex
CREATE INDEX "Chunk_brochureId_chunkOrder_idx" ON "Chunk"("brochureId", "chunkOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationLog_scanId_key" ON "ValidationLog"("scanId");

-- CreateIndex
CREATE INDEX "ValidationLog_documentId_timestamp_idx" ON "ValidationLog"("documentId", "timestamp");

-- CreateIndex
CREATE INDEX "ValidationLog_scanId_timestamp_idx" ON "ValidationLog"("scanId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "OrchestrationLog_workflowId_key" ON "OrchestrationLog"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_insurer_type_idx" ON "Product"("insurer", "type");

-- CreateIndex
CREATE INDEX "RequirementTemplate_productId_idx" ON "RequirementTemplate"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementTemplate_productId_version_key" ON "RequirementTemplate"("productId", "version");

-- CreateIndex
CREATE INDEX "RequirementItem_templateId_groupId_idx" ON "RequirementItem"("templateId", "groupId");

-- CreateIndex
CREATE INDEX "RequirementItem_docType_idx" ON "RequirementItem"("docType");

-- CreateIndex
CREATE INDEX "RequirementCompilerReport_templateId_compiledAt_idx" ON "RequirementCompilerReport"("templateId", "compiledAt");

-- CreateIndex
CREATE INDEX "ChecklistInstance_leadId_appliedAt_idx" ON "ChecklistInstance"("leadId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItemInstance_uploadedDocId_key" ON "ChecklistItemInstance"("uploadedDocId");

-- CreateIndex
CREATE INDEX "ChecklistItemInstance_instanceId_status_idx" ON "ChecklistItemInstance"("instanceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItemInstance_itemId_instanceId_key" ON "ChecklistItemInstance"("itemId", "instanceId");

-- CreateIndex
CREATE INDEX "DocumentScan_leadId_status_idx" ON "DocumentScan"("leadId", "status");

-- CreateIndex
CREATE INDEX "DocumentScan_templateId_itemId_idx" ON "DocumentScan"("templateId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationReport_documentId_key" ON "ValidationReport"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationReport_scanId_key" ON "ValidationReport"("scanId");

-- CreateIndex
CREATE INDEX "AuditTrail_actorId_createdAt_idx" ON "AuditTrail"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_keycloakUserId_key" ON "Session"("keycloakUserId");

-- CreateIndex
CREATE INDEX "Session_keycloakUserId_idx" ON "Session"("keycloakUserId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthRateLimitLog_ip_action_timestamp_idx" ON "AuthRateLimitLog"("ip", "action", "timestamp");

-- AddForeignKey
ALTER TABLE "AgentProfile" ADD CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyLead" ADD CONSTRAINT "PolicyLead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyIssuance" ADD CONSTRAINT "PolicyIssuance_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PolicyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PolicyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PolicyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayReminder" ADD CONSTRAINT "BirthdayReminder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PolicyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrochureLog" ADD CONSTRAINT "BrochureLog_brochureId_fkey" FOREIGN KEY ("brochureId") REFERENCES "Brochure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_brochureId_fkey" FOREIGN KEY ("brochureId") REFERENCES "Brochure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationLog" ADD CONSTRAINT "ValidationLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationLog" ADD CONSTRAINT "ValidationLog_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "DocumentScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrchestrationAgentLog" ADD CONSTRAINT "OrchestrationAgentLog_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "OrchestrationLog"("workflowId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementTemplate" ADD CONSTRAINT "RequirementTemplate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementItem" ADD CONSTRAINT "RequirementItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RequirementTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementCompilerReport" ADD CONSTRAINT "RequirementCompilerReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RequirementTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PolicyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RequirementTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemInstance" ADD CONSTRAINT "ChecklistItemInstance_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ChecklistInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemInstance" ADD CONSTRAINT "ChecklistItemInstance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RequirementItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemInstance" ADD CONSTRAINT "ChecklistItemInstance_uploadedDocId_fkey" FOREIGN KEY ("uploadedDocId") REFERENCES "DocumentScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentScan" ADD CONSTRAINT "DocumentScan_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "PolicyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentScan" ADD CONSTRAINT "DocumentScan_requirementItemId_fkey" FOREIGN KEY ("requirementItemId") REFERENCES "RequirementItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationReport" ADD CONSTRAINT "ValidationReport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationReport" ADD CONSTRAINT "ValidationReport_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "DocumentScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
