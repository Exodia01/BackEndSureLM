import { validateRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!user) return Response.json({ success: false, error: "User not found" }, { status: 404 });

    const { householdName, notes } = await req.json();

    if (!householdName) {
      return Response.json({ success: false, error: "householdName is required" }, { status: 400 });
    }

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