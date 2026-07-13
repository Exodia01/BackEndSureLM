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
        uploadStatus: "UPLOAD_COMPLETE",
      },
    });

    await db.auditTrail.create({
      data: {
        actorType: "SYSTEM",
        actorId: "ocr_pipeline",
        action: "OCR_STARTED",
        entityType: "DOCUMENT",
        entityId: (await params).id,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Upload completed, processing started",
    });
  } catch (error) {
    console.error("Upload completion error:", error);
    return NextResponse.json({ error: "Failed to complete upload" }, { status: 500 });
  }
}
