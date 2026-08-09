import { NextRequest } from "next/server";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { resolveDocumentForAgent, ownershipErrorResponse } from "@/lib/documents/ownership";
import { getDocumentStorage } from "@/lib/documents/storage";
import { writeAuditEvent } from "@/lib/audit";

/**
 * GET /api/documents/:id/download
 * Streams the original file back to the owning agent. Audit-logged.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const { id } = await params;
    if (!id) return Response.json({ success: false, error: "Document ID required" }, { status: 400 });

    const rateLimit = checkRateLimit(user.sub, "documents:download");
    if (!rateLimit.allowed) return rateLimitExceeded("documents:download", rateLimit.retryAfterSeconds);

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

    const storage = getDocumentStorage();
    const buffer = await storage.get(doc.storageKey);
    if (!buffer) {
      return Response.json({ success: false, error: "Stored file not found" }, { status: 404 });
    }

    await writeAuditEvent({
      actorId: userInDb.id,
      actorRole: "agent",
      action: "document.downloaded",
      entityType: "CustomerDocument",
      entityId: doc.id,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="document-${doc.id}.${doc.mimeType === "application/pdf" ? "pdf" : doc.mimeType.split("/")[1]}"`,
      },
    });
  } catch (error) {
    console.error("Download document error:", error);
    return Response.json({ success: false, error: "Failed to download document" }, { status: 500 });
  }
}
