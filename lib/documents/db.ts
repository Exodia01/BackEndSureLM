import { db } from '../db';

export async function createDocument(
  originalHash: string,
  filename: string,
  mimetype: string,
  sizeBytes: number,
  uploadedBy: string,
  documentType: string,
  householdId?: string
) {
  return await db.document.create({
    data: {
      originalHash,
      filename,
      mimetype,
      sizeBytes,
      uploadedBy,
      householdId,
      documentType,
    },
    include: {
      auditTrail: true,
    },
  });
}

export async function getDocumentById(documentId: string) {
  return await db.document.findUnique({
    where: { id: documentId },
    include: {
      validations: true,
      validationReport: true,
    },
  });
}

export async function updateDocumentStatus(
  documentId: string,
  newStatus: 'VALIDATED' | 'REJECTED' | 'REVIEW_REQUIRED'
) {
  return await db.document.update({
    where: { id: documentId },
    data: { validationStatus: newStatus, validatedAt: new Date() },
  });
}

export async function createValidationLog(
  documentId: string,
  stage: string,
  status: string,
  configuration: Record<string, unknown>,
  results: Record<string, unknown>
) {
  return await db.validationLog.create({
    data: {
      documentId,
      stage,
      status,
      configuration: JSON.stringify(configuration),
      results: JSON.stringify(results),
    },
  });
}

export async function createValidationReport(
  documentId: string,
  overallStatus: string,
  confidenceScore: number,
  extractedData: Record<string, unknown>,
  discrepancies?: Record<string, unknown>[],
  visualConfidence?: number,
  ruleConfidence?: number,
  externalMatch?: number
) {
  return await db.validationReport.create({
    data: {
      documentId,
      overallStatus,
      confidenceScore,
      extractedData: JSON.stringify(extractedData),
      discrepancies: discrepancies ? JSON.stringify(discrepancies) : null,
      visualConfidence: visualConfidence ?? 0,
      ruleConfidence: ruleConfidence ?? 0,
      externalMatch: externalMatch ?? null,
    },
  });
}

export async function createAuditTrail(
  actorType: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  requestId?: string
) {
  return await db.auditTrail.create({
    data: {
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      requestId,
    },
  });
}

export async function linkDocumentToHousehold(documentId: string, householdId: string) {
  return await db.document.update({
    where: { id: documentId },
    data: { householdId },
  });
}
