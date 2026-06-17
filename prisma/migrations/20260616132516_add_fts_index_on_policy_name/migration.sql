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

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

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
