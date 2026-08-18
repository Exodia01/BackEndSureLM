/**
 * Canonical audit service. Create-only by design: AuditEvent rows are
 * append-only records of what happened. There is deliberately NO update or
 * delete path — retention/archival is an operational concern handled outside
 * the application, never by mutating or removing audit rows from app code.
 *
 * Callers must pass already-sanitized metadata: never include raw OCR output
 * or full document contents. Mask PII before handing anything to `metadata`.
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { maskDocumentPII } from "@/lib/documents/pii";

export type AuditAction =
  | "document.uploaded"
  | "document.duplicate"
  | "document.rejected"
  | "document.deleted"
  | "document.reviewed"
  | "document.retried"
  | "document.downloaded"
  | "document.validation_review_required"
  | "document.ocr_failed"
  | "document.extraction_failed"
  | "document.validation_failed"
  | "document.job_started"
  | "document.job_completed"
  | "document.job_failed"
  | "document.storage_error"
  | "application.created"
  | "application.submitted"
  | "application.approved"
  | "application.approval_blocked"
  | "application.rejected"
  | "application.checklist_viewed"
  | "issuance.created"
  | "lead.created";

export interface AuditEventInput {
  actorId: string;
  actorRole?: string | null;
  action: AuditAction;
  entityType: "CustomerDocument" | "DocumentJob" | "Application" | "PolicyLead" | "PolicyIssuance" | "User";
  entityId: string;
  metadata?: Record<string, unknown> | null;
}

let failedAuditCount = 0;

/**
 * Returns the number of audit writes that have failed since process start.
 * Useful for health-check endpoints and monitoring.
 */
export function getFailedAuditCount(): number {
  return failedAuditCount;
}

/**
 * Record an audit event. Never throws: auditing must not break the primary
 * operation, so failures are logged and swallowed. Structured logging ensures
 * failed audit events are diagnosable in production.
 */
export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata
          ? (maskDocumentPII(input.metadata) as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (error) {
    failedAuditCount++;
    console.error(
      JSON.stringify({
        level: "error",
        event: "audit_write_failed",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorId: input.actorId,
        failureCount: failedAuditCount,
        error: (error as Error).message,
      })
    );
  }
}
