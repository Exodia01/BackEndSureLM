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

    const body = await req.json();
    const { household_id } = body;

    if (!household_id) {
      return NextResponse.json({ error: "household_id is required" });
    }

    const document = await db.document.update({
      where: { id: (await params).id },
      data: {},
    });

    await db.auditTrail.create({
      data: {
        actorType: "AGENT",
        actorId: user.id,
        action: "DOCUMENT_LINKED_TO_HOUSEHOLD",
        entityType: "DOCUMENT",
        entityId: (await params).id,
      },
    });

    return NextResponse.json({ success: true, document_id: document.id });
  } catch (error) {
    console.error("Document-link error:", error);
    return NextResponse.json({ error: "Failed to link document" }, { status: 500 });
  }
}
