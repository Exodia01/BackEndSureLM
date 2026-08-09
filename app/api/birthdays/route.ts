import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAuth, getUserFromToken, ensureUserInDb } from "@/lib/auth/keycloak";
import { requireAgent, requireAuth } from "@/lib/auth/guards";

interface LeadWithDOB {
  id: string;
  householdName: string;
  phone: string | null;
  dateOfBirth: Date | null;
}

async function refreshBirthdays(agentId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const leads: LeadWithDOB[] = await db.policyLead.findMany({
    where: { agentId, dateOfBirth: { not: null } },
    select: { id: true, householdName: true, phone: true, dateOfBirth: true },
  });

  await db.birthdayReminder.deleteMany({
    where: { leadId: { in: leads.map((l: LeadWithDOB) => l.id) } },
  });

  const reminders = leads
    .filter((l: LeadWithDOB) => l.dateOfBirth !== null)
    .map((l: LeadWithDOB) => {
      const dob = new Date(l.dateOfBirth!);
      const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }
      const daysUntil = Math.round(
        (thisYearBirthday.getTime() - today.getTime()) / 86400000
      );
      return {
        leadId: l.id,
        name: l.householdName,
        phone: l.phone ?? null,
        dateOfBirth: l.dateOfBirth!,
        daysUntil,
        isToday: daysUntil === 0,
        wishSent: false,
        refreshedAt: new Date(),
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  await db.birthdayReminder.createMany({ data: reminders });
  return reminders;
}

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

    const leads: LeadWithDOB[] = await db.policyLead.findMany({
      where: { agentId: userInDb.id },
      select: { id: true, householdName: true, phone: true, dateOfBirth: true },
    });

    const count = await db.birthdayReminder.count({
      where: { leadId: { in: leads.map((l: LeadWithDOB) => l.id) } },
    });

    if (count === 0) await refreshBirthdays(userInDb.id);

    const reminders = await db.birthdayReminder.findMany({
      where: { leadId: { in: leads.map((l: LeadWithDOB) => l.id) } },
      include: {
        lead: {
          select: {
            status: true,
            issuances: { select: { policyName: true, premiumAmount: true } },
          },
        },
      },
      orderBy: { daysUntil: "asc" },
    });

    return NextResponse.json({ success: true, data: reminders });
  } catch (error) {
    console.error("Birthday fetch error:", error);
    return Response.json({ success: false, error: "Failed to fetch birthdays" }, { status: 500 });
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

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const reminders = await refreshBirthdays(userInDb.id);
    return Response.json({ success: true, data: reminders });
  } catch (error) {
    console.error("Birthday refresh error:", error);
    return Response.json({ success: false, error: "Failed to refresh" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;
    const { id } = await req.json();

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const userInDb = await db.user.findUnique({ where: { keycloakId: user.sub } });
    if (!userInDb) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const existing = await db.birthdayReminder.findFirst({
      where: { id, lead: { agentId: userInDb.id } },
      include: { lead: true },
    });
    if (!existing) return Response.json({ success: false, error: "Not found" }, { status: 404 });
    const updated = await db.birthdayReminder.update({
      where: { id },
      data: { wishSent: true },
    });

    return Response.json({ success: true, data: updated });
  } catch (error) {
    console.error("Birthday update error:", error);
    return Response.json({ success: false, error: "Failed to update" }, { status: 500 });
  }
}