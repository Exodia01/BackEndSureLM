import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { validateAuth, getUserFromToken, ensureUserInDb } from "@/lib/auth/keycloak";
import { requireAgent, requireAuth } from "@/lib/auth/guards";

// GET /api/messages?leadId=xxx
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

    const messages = await db.message.findMany({
      where: { leadId },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({ success: true, data: messages });
  } catch (error) {
    console.error("Fetch messages error:", error);
    return Response.json({ success: false, error: "Failed to fetch messages" }, { status: 500 });
  }
}

// POST /api/messages
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;
    const { leadId, role, content, policies } = await req.json();
    if (!leadId || !role || !content) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: userInDb.id } });
    if (!lead) return Response.json({ success: false, error: "Lead not found" }, { status: 404 });

    const message = await db.message.create({
      data: {
        leadId,
        role: role.toUpperCase(),
        content,
        policies: policies ?? null,
      },
    });

    return Response.json({ success: true, data: message });
  } catch (error) {
    console.error("Save message error:", error);
    return Response.json({ success: false, error: "Failed to save message" }, { status: 500 });
  }
}