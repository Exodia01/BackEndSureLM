import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { validateAuth, getUserFromToken, ensureUserInDb } from "@/lib/auth/keycloak";
import { requireAgent } from "@/lib/auth/guards";

// POST /api/reminders — create a reminder
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;
    const { leadId, type, scheduledAt, note } = await req.json();
    if (!leadId || !type || !scheduledAt) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: userInDb.id } });
    if (!lead) return Response.json({ success: false, error: "Lead not found" }, { status: 404 });

    const reminder = await db.reminder.create({
      data: { leadId, type, scheduledAt: new Date(scheduledAt), note: note ?? null },
    });

    return Response.json({ success: true, data: reminder });
  } catch (error) {
    console.error("Create reminder error:", error);
    return Response.json({ success: false, error: "Failed to create reminder" }, { status: 500 });
  }
}

// PATCH /api/reminders — mark reminder as done
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;
    const { reminderId } = await req.json();
    if (!reminderId) return Response.json({ success: false, error: "reminderId required" }, { status: 400 });

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const reminder = await db.reminder.findFirst({
      where: { id: reminderId, lead: { agentId: userInDb.id } },
      include: { lead: true },
    });
    if (!reminder) return Response.json({ success: false, error: "Reminder not found" }, { status: 404 });

    const updated = await db.reminder.update({
      where: { id: reminderId },
      data: { isDone: true },
    });

    return Response.json({ success: true, data: updated });
  } catch (error) {
    console.error("Update reminder error:", error);
    return Response.json({ success: false, error: "Failed to update reminder" }, { status: 500 });
  }
}