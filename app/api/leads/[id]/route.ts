import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { validateAuth, getUserFromToken, ensureUserInDb } from "@/lib/auth/keycloak";
import { requireAgent } from "@/lib/auth/guards";

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const leadId = req.nextUrl.searchParams.get("id");
    if (!leadId) return Response.json({ success: false, error: "Lead ID required" }, { status: 400 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: userInDb.id } });
    if (!lead) return Response.json({ success: false, error: "Lead not found" }, { status: 404 });

    await db.policyLead.delete({ where: { id: lead.id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete lead error:", error);
    return Response.json({ success: false, error: "Failed to delete lead" }, { status: 500 });
  }
}