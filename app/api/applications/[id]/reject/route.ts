import { NextRequest } from "next/server";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { rejectApplication, ApplicationError } from "@/lib/applications/lifecycle";

/**
 * POST /api/applications/:id/reject
 * Body: { reason?: string }
 * Explicit suitability rejection (SUBMITTED/UNDERWRITING/DOCUMENTS_REQUIRED → REJECTED).
 * Ownership is enforced inside the lifecycle service.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const rateLimit = checkRateLimit(user.sub, "applications:reject");
    if (!rateLimit.allowed) return rateLimitExceeded("applications:reject", rateLimit.retryAfterSeconds);

    const { id } = await params;
    if (!id) return Response.json({ success: false, error: "Application ID required" }, { status: 400 });

    const userInDb = await ensureUserInDb({
      sub: user.sub,
      email: user.email,
      name: user.name,
      realm_access: { roles: user.realmRoles },
      resource_access: { "web-app": { roles: user.clientRoles } },
    });

    const body = (await req.json().catch(() => null)) as { reason?: string } | null;
    const result = await rejectApplication({
      applicationId: id,
      agentId: userInDb.id,
      reason: typeof body?.reason === "string" ? body.reason.slice(0, 2000) : undefined,
    });
    return Response.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return Response.json(
        { success: false, error: error.message, data: error.data ?? undefined },
        { status: error.statusCode }
      );
    }
    console.error("Reject application error:", error);
    return Response.json({ success: false, error: "Failed to reject application" }, { status: 500 });
  }
}
