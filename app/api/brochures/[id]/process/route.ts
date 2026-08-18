import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { processBrochure } from "@/lib/pdf/batchProcess";
import {
  checkRateLimit,
  rateLimitExceeded,
} from "@/lib/security/rateLimiter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const rl = checkRateLimit(auth.user.sub, "brochures:process");
  if (!rl.allowed) return rateLimitExceeded("brochures:process", rl.retryAfterSeconds);

  try {
    const { id } = await params;

    const brochure = await db.brochure.findUnique({ where: { id } });
    if (!brochure) {
      return NextResponse.json(
        { error: "Brochure not found" },
        { status: 404 }
      );
    }

    if (brochure.status === "READY") {
      return NextResponse.json(
        { message: "Brochure is already processed", brochureId: id }
      );
    }

    const result = await processBrochure(id);

    return NextResponse.json({
      success: true,
      brochureId: id,
      chunksCreated: result.chunksCreated,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("[POST /api/brochures/[id]/process] Error:", error);

    return NextResponse.json(
      { error: "Failed to process brochure", message: (error as Error).message },
      { status: 500 }
    );
  }
}
