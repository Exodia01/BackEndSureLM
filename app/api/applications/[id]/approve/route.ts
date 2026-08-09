import { NextRequest } from "next/server";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { approveApplication, ApplicationError } from "@/lib/applications/lifecycle";

/**
 * POST /api/applications/:id/approve
 *
 * Deterministic approval gate (SUB → APPROVED). Re-runs the frozen-snapshot
 * checklist against the application's validated documents. Any unsatisfied
 * requirement, REVIEW_REQUIRED document, or failed document blocks approval
 * with 409 and the list of blockers. The LLM recommendation engine is never
 * consulted for suitability — eligibility is deterministic and evidence-based.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const rateLimit = checkRateLimit(user.sub, "applications:approve");
    if (!rateLimit.allowed) return rateLimitExceeded("applications:approve", rateLimit.retryAfterSeconds);

    const { id } = await params;
    if (!id) return Response.json({ success: false, error: "Application ID required" }, { status: 400 });

    const userInDb = await ensureUserInDb({
      sub: user.sub,
      email: user.email,
      name: user.name,
      realm_access: { roles: user.realmRoles },
      resource_access: { "web-app": { roles: user.clientRoles } },
    });

    const result = await approveApplication({ applicationId: id, agentId: userInDb.id });
    return Response.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ApplicationError) {
      return Response.json(
        { success: false, error: error.message, data: error.data ?? undefined },
        { status: error.statusCode }
      );
    }
    console.error("Approve application error:", error);
    return Response.json({ success: false, error: "Failed to approve application" }, { status: 500 });
  }
}
