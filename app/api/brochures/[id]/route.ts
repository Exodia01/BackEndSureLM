import { keycloakAuth } from "@/lib/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const brochure = await db.brochure.findUnique({
      where: { id: (await params).id },
      include: { chunks: true, Log: true },
    });

    if (!brochure) return NextResponse.json({ error: "Brochure not found" }, { status: 404 });

    return NextResponse.json({ success: true, data: brochure });
  } catch (error) {
    console.error("Brochure fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch brochure" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    await db.brochure.delete({
      where: { id: (await params).id },
    });

    return NextResponse.json({ success: true, message: "Brochure deleted" });
  } catch (error) {
    console.error("Broker deletion error:", error);
    return NextResponse.json({ error: "Failed to delete brochure" }, { status: 500 });
  }
}
