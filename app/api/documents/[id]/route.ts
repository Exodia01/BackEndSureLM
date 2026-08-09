import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { resolveDocumentForAgent, ownershipErrorResponse } from "@/lib/documents/ownership";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/documents/:id
 * Returns document status + lifecycle details for the owning agent.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const { id } = await params;
    if (!id) return Response.json({ success: false, error: "Document ID required" }, { status: 400 });

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

    // Never return ocrData/extractedData with raw PII over the wire.
    const report = await db.documentValidationReport.findUnique({
      where: { documentId: doc.id },
      select: { status: true, deterministicPass: true, discrepancies: true, docTypeDetected: true },
    });

    return Response.json({
      success: true,
      data: {
        id: doc.id,
        applicationId: doc.applicationId,
        docType: doc.docType,
        status: doc.status,
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        pageCount: doc.pageCount,
        attempts: doc.attempts,
        requirementRuleKey: doc.requirementRuleKey,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        validation: report ?? null,
        stageLog: await db.documentStageLog.findMany({
          where: { documentId: doc.id },
          orderBy: { createdAt: "asc" },
          select: { stage: true, status: true, model: true, confidence: true, createdAt: true },
        }),
      },
    });
  } catch (error) {
    console.error("Get document error:", error);
    return Response.json({ success: false, error: "Failed to load document" }, { status: 500 });
  }
}
