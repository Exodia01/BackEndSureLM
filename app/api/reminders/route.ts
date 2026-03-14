import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// POST /api/reminders — create a reminder
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { leadId, type, scheduledAt, note } = await req.json();
    if (!leadId || !type || !scheduledAt) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: user.id } });
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
    const { userId: clerkId } = await auth();
    if (!clerkId) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { reminderId } = await req.json();
    if (!reminderId) return Response.json({ success: false, error: "reminderId required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const reminder = await db.reminder.findFirst({
      where: { id: reminderId, lead: { agentId: user.id } },
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