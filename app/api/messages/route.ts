import { keycloakAuth } from "@/lib/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const leadId = req.nextUrl.searchParams.get("leadId");
    if (!leadId) return Response.json({ success: false, error: "leadId required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: user.id } });
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

export async function POST(req: NextRequest) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const { leadId, role, content, policies } = await req.json();
    if (!leadId || !role || !content) {
      return Response.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId: user.id } });
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