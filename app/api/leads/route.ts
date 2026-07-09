import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkId } });
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
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { householdName, notes } = await req.json();

    if (!householdName) {
      return Response.json({ success: false, error: "householdName is required" }, { status: 400 });
    }

    // Get or create user in DB with timeout
    let clerkUser: any;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      clerkUser = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        signal: controller.signal,
      }).then((r) => r.json());
    } catch (error) {
      console.warn("[leads] Clerk API failed, using DB user:", error);
      const existingUser = await db.user.findUnique({ where: { clerkId } });
      if (!existingUser) {
        throw new Error("Clerk API unavailable and user not found in DB");
      }
      clerkUser = existingUser;
    }

    const user = await db.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        email: clerkUser.email_addresses?.[0]?.email_address ?? "",
        name: `${clerkUser.first_name ?? ""} ${clerkUser.last_name ?? ""}`.trim() || "Agent",
        avatar: clerkUser.image_url ?? null,
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