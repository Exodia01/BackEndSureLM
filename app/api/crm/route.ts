import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { PolicyLead, PolicyIssuance, Reminder } from "@prisma/client";

type LeadWithRelations = PolicyLead & {
  issuances: PolicyIssuance[];
  reminders: Reminder[];
};

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return Response.json({ success: true, data: { leads: [], stats: {} } });

    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    const leads: LeadWithRelations[] = await db.policyLead.findMany({
      where: { agentId: user.id },
      include: {
        issuances: true,
        reminders: { where: { isDone: false }, orderBy: { scheduledAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const leadsWithFlags = leads.map((lead: LeadWithRelations) => {
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
        (i: PolicyIssuance) => i.nextPremiumDue && new Date(i.nextPremiumDue) >= today && new Date(i.nextPremiumDue) <= in30Days
      );

      const premiumsDueUrgent = lead.issuances.filter(
        (i: PolicyIssuance) => i.nextPremiumDue && new Date(i.nextPremiumDue) >= today && new Date(i.nextPremiumDue) <= in7Days
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
      policiesIssued: leads.filter((l: LeadWithRelations) => l.status === "POLICY_ISSUED").length,
      activeReminders: leads.reduce((acc: number, l: LeadWithRelations) => acc + l.reminders.length, 0),
    };

    return Response.json({ success: true, data: { leads: leadsWithFlags, stats } });
  } catch (error) {
    console.error("CRM fetch error:", error);
    return Response.json({ success: false, error: "Failed to fetch CRM data" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { leadId, ...updates } = await req.json();
    if (!leadId) return Response.json({ success: false, error: "leadId required" }, { status: 400 });

    const lead = await db.policyLead.update({
      where: { id: leadId },
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

    return Response.json({ success: true, data: lead });
  } catch (error) {
    console.error("CRM update error:", error);
    return Response.json({ success: false, error: "Failed to update lead" }, { status: 500 });
  }
}
