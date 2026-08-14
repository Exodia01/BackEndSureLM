import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { validateAuth, getUserFromToken, ensureUserInDb } from "@/lib/auth/keycloak";
import { requireAgent, requireAuth } from "@/lib/auth/guards";
import { writeAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
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
    if (!userInDb) return Response.json({ success: true, data: [] });

    const leads = await db.policyLead.findMany({
      where: { agentId: userInDb.id },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ success: true, data: leads });
  } catch (error) {
    console.error("Fetch leads error:", error);
    return Response.json({ success: false, error: "Failed to fetch leads" }, { status: 500 });
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
    const { householdName, notes } = await req.json();

    if (!householdName) {
      return Response.json({ success: false, error: "householdName is required" }, { status: 400 });
    }

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.create({
      data: {
        agentId: userInDb.id,
        householdName,
        notes: notes ?? null,
        status: "NEW",
      },
    });

    await writeAuditEvent({
      actorId: userInDb.id,
      actorRole: "agent",
      action: "lead.created",
      entityType: "PolicyLead",
      entityId: lead.id,
      metadata: { notes: notes ?? null },
    });

    return Response.json({ success: true, data: lead });
  } catch (error) {
    console.error("Create lead error:", error);
    return Response.json({ success: false, error: "Failed to create lead" }, { status: 500 });
  }
}