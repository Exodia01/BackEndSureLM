import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { resolveDocumentForAgent, ownershipErrorResponse } from "@/lib/documents/ownership";
import { enqueueDocumentJob } from "@/lib/documents/jobs";
import { writeAuditEvent } from "@/lib/audit";

/**
 * POST /api/documents/:id/retry
 * Allows the owning agent to retry a failed document (OCR_FAILED /
 * EXTRACTION_FAILED / VALIDATION_FAILED). Queues a fresh job and resets the
 * document to PROCESSING.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const { id } = await params;
    if (!id) return Response.json({ success: false, error: "Document ID required" }, { status: 400 });

    const rateLimit = checkRateLimit(user.sub, "documents:retry");
    if (!rateLimit.allowed) return rateLimitExceeded("documents:retry", rateLimit.retryAfterSeconds);

    const userInDb = await ensureUserInDb({
      sub: user.sub,
      email: user.email,
      name: user.name,
      realm_access: { roles: user.realmRoles },
      resource_access: { "web-app": { roles: user.clientRoles } },
    });

    const ownership = await resolveDocumentForAgent(userInDb.id, id);
    if (!ownership.ok) return ownershipErrorResponse(ownership);
    const doc = ownership.value;

    const retryableStatuses = ["OCR_FAILED", "EXTRACTION_FAILED", "VALIDATION_FAILED"];
    if (!retryableStatuses.includes(doc.status)) {
      return Response.json({ success: false, error: `Document is not in a retryable state (${doc.status})` }, { status: 409 });
    }

    await db.customerDocument.update({
      where: { id: doc.id },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });

    await enqueueDocumentJob(doc.id);

    await writeAuditEvent({
      actorId: userInDb.id,
      actorRole: "agent",
      action: "document.retried",
      entityType: "CustomerDocument",
      entityId: doc.id,
      metadata: { previousStatus: doc.status },
    });

    return Response.json({ success: true, data: { id: doc.id, status: "PROCESSING" } });
  } catch (error) {
    console.error("Retry document error:", error);
    return Response.json({ success: false, error: "Failed to retry document" }, { status: 500 });
  }
}
