import { keycloakAuth } from "@/lib/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await keycloakAuth(req);
    if (!result.authenticated) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({
      where: { id, agentId: user.id },
    });
    if (!lead) return Response.json({ success: false, error: "Lead not found" }, { status: 404 });

    await db.policyLead.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete lead error:", error);
    return Response.json({ success: false, error: "Failed to delete lead" }, { status: 500 });
  }
}