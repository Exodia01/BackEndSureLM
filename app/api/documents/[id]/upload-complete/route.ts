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

    const document = await db.document.update({
      where: { id: (await params).id },
      data: {
        scanStatus: "UPLOADED",
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
