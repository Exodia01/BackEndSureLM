import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { deleteBrochureQdrantChunks } from "@/lib/pdf/batchProcess";
import fs from "fs/promises";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    
    const brochure = await db.brochure.findUnique({
      where: { id },
      select: {
        id: true,
        basename: true,
        originalName: true,
        filePath: true,
        currentPage: true,
        totalPages: true,
        status: true,
        versionNum: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!brochure) {
      return NextResponse.json(
        { error: "Brochure not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(brochure);
  } catch (error) {
    console.error("[GET /api/brochures/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch brochure" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const brochure = await db.brochure.findUnique({
      where: { id }
    });

    if (!brochure) {
      return NextResponse.json(
        { error: "Brochure not found" },
        { status: 404 }
      );
    }

    // Remove vector chunks from Qdrant, then the DB row (and chunks via cascade
    // is not guaranteed — remove explicitly), then the file from disk.
    await deleteBrochureQdrantChunks(id);

    await db.$transaction([
      db.chunk.deleteMany({ where: { brochureId: id } }),
      db.policyBrochure.deleteMany({ where: { brochureId: id } }),
      db.requirementDefinition.deleteMany({ where: { brochureId: id } }),
    ]);

    await db.brochure.delete({
      where: { id }
    });

    if (brochure.filePath) {
      try {
        await fs.unlink(brochure.filePath);
      } catch (fileError) {
        console.warn(`[DELETE /api/brochures/[id]] Could not remove file:`, fileError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/brochures/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete brochure" },
      { status: 500 }
    );
  }
}
