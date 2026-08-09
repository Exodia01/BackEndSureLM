import { NextRequest } from "next/server";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { writeAuditEvent } from "@/lib/audit";
import {
  createApplication,
  ApplicationError,
} from "@/lib/applications/lifecycle";

/**
 * POST /api/applications
 * Body: { leadId, policyName?, policyId? }
 *
 * Creates (or reuses) a DRAFT Application for the lead. The lead must belong
 * to the authenticated agent (IDOR chain). Delegates to the canonical
 * createApplication lifecycle service, which resolves ONLY an existing, active
 * policy with a current published version and a frozen RequirementSnapshot.
 *
 * Policy catalog records are NEVER manufactured from customer/chat input (P1):
 * an unknown policy name returns 404 "Policy not found".
 *
 * Reuses the existing active application for (lead, policy, version) when one
 * exists (the partial unique index allows only one non-terminal application).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const rateLimit = checkRateLimit(user.sub, "applications:create");
    if (!rateLimit.allowed) return rateLimitExceeded("applications:create", rateLimit.retryAfterSeconds);

    const userInDb = await ensureUserInDb({
      sub: user.sub,
      email: user.email,
      name: user.name,
      realm_access: { roles: user.realmRoles },
      resource_access: { "web-app": { roles: user.clientRoles } },
    });

    const body = (await req.json().catch(() => null)) as {
      leadId?: string;
      policyName?: string;
      policyId?: string;
    } | null;
    const leadId = body?.leadId;
    const policyName = body?.policyName;
    const policyId = body?.policyId;
    if (!leadId || (!policyName && !policyId)) {
      return Response.json(
        { success: false, error: "leadId and policyName (or policyId) are required" },
        { status: 400 }
      );
    }

    const application = await createApplication({ agentId: userInDb.id, leadId, policyName, policyId });

    await writeAuditEvent({
      actorId: userInDb.id,
      actorRole: "agent",
      action: "application.created",
      entityType: "Application",
      entityId: application.id,
      metadata: {
        leadId,
        policyId: application.policyId,
        policyVersionId: application.policyVersionId,
        status: application.status,
      },
    });

    return Response.json(
      {
        success: true,
        data: {
          id: application.id,
          leadId,
          policyId: application.policyId,
          policyName: application.policyName,
          policyVersionId: application.policyVersionId,
          status: application.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApplicationError) {
      return Response.json(
        { success: false, error: error.message, data: error.data ?? undefined },
        { status: error.statusCode }
      );
    }
    console.error("Create application error:", error);
    return Response.json({ success: false, error: "Failed to create application" }, { status: 500 });
  }
}
