import { keycloakAuth } from "@/lib/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return Response.json({ success: true, data: [] });

    const leads = await db.policyLead.findMany({
      where: { agentId: user.id },
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
    const result = await keycloakAuth(req);
    if (!result.authenticated) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const { householdName, notes } = await req.json();

    if (!householdName) {
      return Response.json({ success: false, error: "householdName is required" }, { status: 400 });
    }

    const payload = result.payload;
    const email = Array.isArray(payload.email) ? payload.email[0] : (payload.email as string);
    const name = `${payload.given_name ?? ""} ${payload.family_name ?? ""}`.trim() || "Agent";

    const user = await db.user.upsert({
      where: { keycloakId },
      update: {},
      create: {
        keycloakId,
        email: email ?? "",
        name: name,
        role: "AGENT",
      },
    });

    const lead = await db.policyLead.create({
      data: {
        agentId: user.id,
        householdName,
        notes: notes ?? null,
        status: "NEW",
      },
    });

    return Response.json({ success: true, data: lead });
  } catch (error) {
    console.error("Create lead error:", error);
    return Response.json({ success: false, error: "Failed to create lead" }, { status: 500 });
  }
}