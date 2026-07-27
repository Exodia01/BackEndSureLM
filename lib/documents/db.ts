import { db } from '../db';
import { ValidationStatus, ValidationStage } from '@prisma/client';

export async function createDocument(
  filename: string,
  source: string | null,
  uploadedBy: string,
  householdId?: string
) {
  return await db.document.create({
    data: {
      filename,
      source,
      uploadedById: uploadedBy,
      householdId: householdId ?? undefined,
    },
    include: {
      validationReport: true,
    },
  });
}

export async function getDocumentById(documentId: string) {
  return await db.document.findUnique({
    where: { id: documentId },
    include: {
      validationLogs: true,
      validationReport: true,
    },
  });
}

export async function updateValidationStatus(
  documentId: string,
  status: 'VALIDATED' | 'REJECTED' | 'REVIEW_REQUIRED'
) {
  return await db.validationReport.update({
    where: { documentId },
    data: {
      overallStatus: status as any,
      validatedAt: new Date(),
    },
  });
}

export async function createValidationLog(
  documentId: string,
  stage: ValidationStage,
  status: ValidationStatus,
  configuration?: Record<string, unknown>,
  results?: Record<string, unknown>
) {
  return await db.validationLog.create({
    data: {
      documentId,
      stage,
      status,
      configuration: JSON.stringify(configuration || {}) as any,
      results: JSON.stringify(results || {}) as any,
    },
  });
}

export async function createValidationReport(
  documentId: string,
  overallStatus: 'PENDING' | 'PROCESSING' | 'VALIDATED' | 'REJECTED',
  aiConfidence?: number
) {
  return await db.validationReport.create({
    data: {
      documentId,
      overallStatus: overallStatus as any,
      rulesPassed: 0,
      rulesFailed: 0,
      aiConfidence: aiConfidence ?? null,
    },
  });
}

export async function createAuditTrail(
  actorType: string,
  actorId: string,
  action: string,
  entityType?: string,
  entityId?: string
) {
  return await db.auditTrail.create({
    data: {
      actorType,
      actorId,
      action,
      entityType: entityType ?? undefined,
      entityId: entityId ?? undefined,
    },
  });
}

export async function linkDocumentToHousehold(documentId: string, householdId: string | null) {
  return await db.document.update({
    where: { id: documentId },
    data: { householdId },
  });
}
