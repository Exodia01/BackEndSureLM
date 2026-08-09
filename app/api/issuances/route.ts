import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { requireAgent } from "@/lib/auth/guards";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { issuePolicy, IssuanceGateError } from "@/lib/issuance/issuePolicy";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;
    const leadId = req.nextUrl.searchParams.get("leadId");
    if (!leadId) return Response.json({ success: false, error: "leadId required" }, { status: 400 });

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: userInDb.id } });
    if (!lead) return Response.json({ success: false, error: "Lead not found" }, { status: 404 });

    const issuances = await db.policyIssuance.findMany({
      where: { leadId },
      select: { policyName: true },
    });

    return Response.json({ success: true, data: issuances });
  } catch (error) {
    console.error("Fetch issuances error:", error);
    return Response.json({ success: false, error: "Failed to fetch issuances" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;

    // Rate limiting
    const rateLimit = checkRateLimit(user.sub, "issuances:create");
    if (!rateLimit.allowed) {
      return rateLimitExceeded("issuances:create", rateLimit.retryAfterSeconds);
    }

    const { applicationId, leadId, premiumAmount } = await req.json();
    if (!applicationId) {
      return Response.json({ success: false, error: "applicationId required" }, { status: 400 });
    }

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    // Premium is parsed from a client-supplied figure only when present; it is
    // informational (collection amount), never used for suitability.
    const parsedPremium =
      typeof premiumAmount === "number" && Number.isFinite(premiumAmount)
        ? premiumAmount
        : typeof premiumAmount === "string"
          ? parseInt(premiumAmount.replace(/[^0-9]/g, "")) || null
          : null;

    const result = await issuePolicy({
      applicationId,
      agentId: userInDb.id,
      agentSub: user.sub,
      expectedLeadId: leadId ?? undefined,
      premiumAmount: parsedPremium,
    });

    return Response.json({ success: true, data: result.issuance }, { status: 201 });
  } catch (error) {
    if (error instanceof IssuanceGateError) {
      return Response.json(
        { success: false, error: error.message, data: error.data ?? undefined },
        { status: error.statusCode }
      );
    }
    console.error("Issue policy error:", error);
    return Response.json({ success: false, error: "Failed to issue policy" }, { status: 500 });
  }
}