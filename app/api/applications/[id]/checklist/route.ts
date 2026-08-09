import { NextRequest } from "next/server";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { getApplicationChecklist, ApplicationError } from "@/lib/applications/lifecycle";
import { writeAuditEvent } from "@/lib/audit";

/**
 * GET /api/applications/:id/checklist
 *
 * Read-only, derived view of the frozen-snapshot checklist for the owning
 * agent: application status, per-requirement status (ruleKey, label, evidence
 * doc type, satisfied, evidence document id, reason), overall blockers /
 * canApprove flags, and the application's documents (review state only, never
 * PII). The current/latest policy requirements are never consulted — the
 * application's RequirementSnapshot is authoritative.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const rateLimit = checkRateLimit(user.sub, "applications:checklist");
    if (!rateLimit.allowed) return rateLimitExceeded("applications:checklist", rateLimit.retryAfterSeconds);

    const { id } = await params;
    if (!id) return Response.json({ success: false, error: "Application ID required" }, { status: 400 });

    const userInDb = await ensureUserInDb({
      sub: user.sub,
      email: user.email,
      name: user.name,
      realm_access: { roles: user.realmRoles },
      resource_access: { "web-app": { roles: user.clientRoles } },
    });

    const data = await getApplicationChecklist(userInDb.id, id);

    await writeAuditEvent({
      actorId: userInDb.id,
      actorRole: "agent",
      action: "application.checklist_viewed",
      entityType: "Application",
      entityId: id,
      metadata: { status: data.application.status, requirements: data.evaluation.requirements.length },
    });

    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return Response.json(
        { success: false, error: error.message, data: error.data ?? undefined },
        { status: error.statusCode }
      );
    }
    console.error("Get application checklist error:", error);
    return Response.json({ success: false, error: "Failed to load application checklist" }, { status: 500 });
  }
}
