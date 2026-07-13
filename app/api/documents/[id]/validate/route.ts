import { keycloakAuth } from "@/lib/auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await keycloakAuth(req);
    if (!result.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const keycloakId = result.keycloakId;

    const user = await db.user.findUnique({ where: { keycloakId } });
    if (!user) return NextResponse.json({ error: "User not found" });

    const document = await db.document.update({
      where: { id: (await params).id },
      data: {
        validationStatus: "IN_PROGRESS",
      },
    });

    await db.auditTrail.create({
      data: {
        actorType: "SYSTEM",
        actorId: "validation_service",
        action: "VALIDATION_STARTED",
        entityType: "DOCUMENT",
        entityId: (await params).id,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Validation started",
      status: document.validationStatus,
    });
  } catch (error) {
    console.error("Validation submission error:", error);
    return NextResponse.json({ error: "Failed to start validation" }, { status: 500 });
  }
}
