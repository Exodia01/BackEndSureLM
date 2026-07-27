import { validateRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const leadId = (await params).id;

    const lead = await db.policyLead.findFirst({
      where: { id: leadId, agentId: user.id },
    });
    if (!lead) return Response.json({ success: false, error: "Lead not found" }, { status: 404 });

    await db.policyLead.delete({ where: { id: leadId } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete lead error:", error);
    return Response.json({ success: false, error: "Failed to delete lead" }, { status: 500 });
  }
}