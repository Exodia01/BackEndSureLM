import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAuth, getUserFromToken, ensureUserInDb } from "@/lib/auth/keycloak";
import { requireAgent, requireAuth } from "@/lib/auth/guards";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return NextResponse.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const dbUser = await db.user.findUnique({ where: { keycloakId: user.sub } });

    if (!dbUser) {
      return NextResponse.json(
        { success: true, data: { leads: [], stats: {} } },
        { status: 200 }
      );
    }

    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    const leads = await db.policyLead.findMany({
      where: { agentId: dbUser.id },
      include: {
        issuances: true,
        reminders: { where: { isDone: false } },
      },
      orderBy: { createdAt: "desc" },
    });

    const leadsWithFlags = leads.map((lead) => {
      const isBirthdayToday =
        lead.dateOfBirth !== null &&
        lead.dateOfBirth.getDate() === today.getDate() &&
        lead.dateOfBirth.getMonth() === today.getMonth();

      const isBirthdayThisWeek =
        lead.dateOfBirth !== null && (() => {
          const bday = new Date(lead.dateOfBirth!);
          bday.setFullYear(today.getFullYear());
          return bday >= today && bday <= in7Days;
        })();

      const premiumsDue = lead.issuances.filter(
        (i) => i.nextPremiumDue && new Date(i.nextPremiumDue) >= today && new Date(i.nextPremiumDue) <= in30Days
      );

      const premiumsDueUrgent = lead.issuances.filter(
        (i) => i.nextPremiumDue && new Date(i.nextPremiumDue) >= today && new Date(i.nextPremiumDue) <= in7Days
      );

      return {
        ...lead,
        isBirthdayToday,
        isBirthdayThisWeek,
        hasPremiumDue: premiumsDue.length > 0,
        hasPremiumDueUrgent: premiumsDueUrgent.length > 0,
        premiumsDue,
      };
    });

    const stats = {
      total: leads.length,
      birthdaysToday: leadsWithFlags.filter((l) => l.isBirthdayToday).length,
      birthdaysThisWeek: leadsWithFlags.filter((l) => l.isBirthdayThisWeek).length,
      premiumsDueCount: leadsWithFlags.filter((l) => l.hasPremiumDue).length,
      premiumsDueUrgentCount: leadsWithFlags.filter((l) => l.hasPremiumDueUrgent).length,
      policiesIssued: leads.filter((l) => l.status === "POLICY_ISSUED").length,
      activeReminders: leads.reduce((acc, l) => acc + l.reminders.length, 0),
    };

    return NextResponse.json(
      { success: true, data: { leads: leadsWithFlags, stats } },
      { status: 200 }
    );
  } catch (error) {
    console.error("CRM fetch error:", error);
    return Response.json({ success: false, error: "Failed to fetch CRM data" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return NextResponse.json({ success: false, error: body.error }, { status: auth.response.status });
    }

    const user = auth.user;
    const body = await req.json();
    const { leadId, ...updates } = body;

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: "leadId required" },
        { status: 400 }
      );
    }

    // Self-provision user in DB
    await ensureUserInDb({ sub: user.sub, email: user.email, name: user.name, realm_access: { roles: user.realmRoles }, resource_access: { "web-app": { roles: user.clientRoles } } });

    const dbUser = await db.user.findUnique({ where: { keycloakId: user.sub } });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const lead = await db.policyLead.update({
      where: { id: leadId, agentId: dbUser.id },
      data: {
        ...(updates.status && { status: updates.status }),
        ...(updates.phone !== undefined && { phone: updates.phone }),
        ...(updates.income !== undefined && { income: updates.income ? parseInt(updates.income) : null }),
        ...(updates.familySize !== undefined && { familySize: updates.familySize ? parseInt(updates.familySize) : null }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.dateOfBirth !== undefined && { dateOfBirth: updates.dateOfBirth ? new Date(updates.dateOfBirth) : null }),
        ...(updates.followUpAt !== undefined && { followUpAt: updates.followUpAt ? new Date(updates.followUpAt) : null }),
      },
    });

    return NextResponse.json(
      { success: true, data: lead },
      { status: 200 }
    );
  } catch (error) {
    console.error("CRM update error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update lead" },
      { status: 500 }
    );
  }
}