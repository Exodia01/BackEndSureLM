import { validateRequest } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authenticated, user } = await validateRequest(req);
    if (!authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db.validationLog.create({
      data: {
        documentId: (await params).id,
        stage: "OCR_COMPLETED",
        status: "IN_PROGRESS",
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
      message: "Validation started" });
  } catch (error) {
    console.error("Validation submission error:", error);
    return NextResponse.json({ error: "Failed to start validation" }, { status: 500 });
  }
}
