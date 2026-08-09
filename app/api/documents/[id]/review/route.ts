import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { resolveDocumentForAgent, ownershipErrorResponse } from "@/lib/documents/ownership";
import { writeAuditEvent } from "@/lib/audit";

export interface ReviewDocumentInput {
  userId: string;
  documentId: string;
  verdict: "approve" | "reject";
  notes?: string;
}

/**
 * Apply an agent's review decision to a REVIEW_REQUIRED document using a
 * compare-and-swap (CAS) transaction:
 *
 *   - approve → document VALIDATED, report PASS
 *   - reject  → document REJECTED, report FAIL (notes required)
 *
 * Both the document row and its validation report are only updated when they
 * are still in REVIEW_REQUIRED. Deterministic PASS/FAIL outcomes (report no
 * longer REVIEW_REQUIRED) can therefore never be overridden by a human, and
 * two concurrent reviews of the same document cannot both succeed — exactly
 * one CAS wins, the other returns 409. Throws on CAS failure.
 */
export async function reviewDocument(input: ReviewDocumentInput): Promise<"VALIDATED" | "REJECTED"> {
  const { userId, documentId, verdict, notes } = input;
  const nextStatus = verdict === "approve" ? "VALIDATED" : "REJECTED";
  const reportStatus = verdict === "approve" ? "PASS" : "FAIL";

  const [docRes, reportRes] = await db.$transaction([
    db.customerDocument.updateMany({
      where: { id: documentId, status: "REVIEW_REQUIRED" },
      data: { status: nextStatus },
    }),
    db.documentValidationReport.updateMany({
      where: { documentId, status: "REVIEW_REQUIRED" },
      data: {
        status: reportStatus,
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNotes: notes ? notes.trim().slice(0, 2000) : null,
      },
    }),
  ]);

  if (docRes.count === 0 || reportRes.count === 0) {
    throw new Error("Document is no longer awaiting review (already decided)");
  }
  return nextStatus;
}

/**
 * POST /api/documents/:id/review
 * Body: { verdict: "approve" | "reject", notes?: string }
 * Applies the agent's decision to a REVIEW_REQUIRED document.
 *   - approve → document VALIDATED
 *   - reject  → document REJECTED (notes required)
 * Records the reviewer + notes on the validation report and audits the action.
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

    const rateLimit = checkRateLimit(user.sub, "documents:review");
    if (!rateLimit.allowed) return rateLimitExceeded("documents:review", rateLimit.retryAfterSeconds);

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

    if (doc.status !== "REVIEW_REQUIRED") {
      return Response.json({ success: false, error: `Document is not awaiting review (${doc.status})` }, { status: 409 });
    }

    const body = (await req.json().catch(() => null)) as { verdict?: string; notes?: string } | null;
    const verdict = body?.verdict;
    if (verdict !== "approve" && verdict !== "reject") {
      return Response.json({ success: false, error: 'verdict must be "approve" or "reject"' }, { status: 400 });
    }
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
    if (verdict === "reject" && !notes) {
      return Response.json({ success: false, error: "Notes are required when rejecting a document" }, { status: 400 });
    }

    let nextStatus: "VALIDATED" | "REJECTED";
    try {
      nextStatus = await reviewDocument({
        userId: userInDb.id,
        documentId: doc.id,
        verdict,
        notes: notes || undefined,
      });
    } catch {
      return Response.json({ success: false, error: "Document is not awaiting review (already decided)" }, { status: 409 });
    }

    await writeAuditEvent({
      actorId: userInDb.id,
      actorRole: "agent",
      action: "document.reviewed",
      entityType: "CustomerDocument",
      entityId: doc.id,
      metadata: { verdict, notes: notes ? notes.slice(0, 2000) : undefined },
    });

    return Response.json({ success: true, data: { id: doc.id, status: nextStatus, verdict } });
  } catch (error) {
    console.error("Review document error:", error);
    return Response.json({ success: false, error: "Failed to review document" }, { status: 500 });
  }
}
