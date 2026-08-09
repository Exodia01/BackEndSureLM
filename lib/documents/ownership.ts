/**
 * Ownership resolution for document API routes. Enforces the full IDOR chain:
 *
 *   auth → userInDb → application.leadId → lead.agentId === userInDb.id
 *
 * A document is only reachable through its application, the application only
 * through its lead, and the lead only through its owning agent. Every hop is a
 * where-clause on the PK (never a client-supplied parent id by itself).
 */
import { db } from "@/lib/db";

export interface OwnershipResult<T> {
  ok: true;
  value: T;
}

type FindFirstResult<T> = T extends Promise<infer U> ? NonNullable<U> : NonNullable<T>;

export type ResolveError =
  | { ok: false; reason: "APPLICATION_NOT_FOUND" }
  | { ok: false; reason: "DOCUMENT_NOT_FOUND" }
  | { ok: false; reason: "LEAD_NOT_FOUND" }
  | { ok: false; reason: "NOT_OWNER" };

export async function resolveApplicationForAgent(
  userInDbId: string,
  applicationId: string
): Promise<OwnershipResult<FindFirstResult<ReturnType<typeof db.application.findFirst>>> | ResolveError> {
  const application = await db.application.findFirst({
    where: { id: applicationId },
    include: { lead: { select: { id: true, agentId: true } } },
  });
  if (!application) return { ok: false, reason: "APPLICATION_NOT_FOUND" };
  if (application.lead.agentId !== userInDbId) return { ok: false, reason: "NOT_OWNER" };
  return { ok: true, value: application };
}

export async function resolveDocumentForAgent(
  userInDbId: string,
  documentId: string
): Promise<OwnershipResult<FindFirstResult<ReturnType<typeof db.customerDocument.findFirst>>> | ResolveError> {
  const document = await db.customerDocument.findFirst({
    where: { id: documentId },
    include: {
      application: {
        include: { lead: { select: { id: true, agentId: true } } },
      },
    },
  });
  if (!document) return { ok: false, reason: "DOCUMENT_NOT_FOUND" };
  if (document.application.lead.agentId !== userInDbId) {
    return { ok: false, reason: "NOT_OWNER" };
  }
  return { ok: true, value: document };
}

/** Map a resolve error to a safe HTTP response. */
export function ownershipErrorResponse(error: ResolveError): Response {
  switch (error.reason) {
    case "APPLICATION_NOT_FOUND":
      return Response.json({ success: false, error: "Application not found" }, { status: 404 });
    case "DOCUMENT_NOT_FOUND":
      return Response.json({ success: false, error: "Document not found" }, { status: 404 });
    case "LEAD_NOT_FOUND":
      return Response.json({ success: false, error: "Lead not found" }, { status: 404 });
    case "NOT_OWNER":
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
}
