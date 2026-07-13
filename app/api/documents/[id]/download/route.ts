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
    if (!user) return NextResponse.json({ error: "User not found" });

    const document = await db.document.findUnique({
      where: { id: (await params).id },
    });

    if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const response = NextResponse.json({
      success: true,
      data: {
        id: document.id,
        filename: document.filename,
        source: document.source ?? null,
      },
    });

    return response;
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json({ error: "Failed to prepare download" }, { status: 500 });
  }
}
