import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const policy = await db.policy.findUnique({ where: { id } });
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const brochures = await db.policyBrochure.findMany({
      where: { policyId: id },
      include: {
        brochure: {
          select: {
            id: true,
            basename: true,
            originalName: true,
            status: true,
            versionNum: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ brochures });
  } catch (error) {
    console.error("[GET /api/policies/[id]/brochures] Error:", error);
    return NextResponse.json({ error: "Failed to fetch linked brochures" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "brochures:link");
  if (!limit.allowed) {
    return rateLimitExceeded("brochures:link", limit.retryAfterSeconds);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const brochureId = body?.brochureId;

    if (!brochureId || typeof brochureId !== "string") {
      return NextResponse.json({ error: "brochureId is required" }, { status: 400 });
    }

    const [policy, brochure] = await Promise.all([
      db.policy.findUnique({ where: { id } }),
      db.brochure.findUnique({ where: { id: brochureId } }),
    ]);

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    if (!brochure) {
      return NextResponse.json({ error: "Brochure not found" }, { status: 404 });
    }

    const existing = await db.policyBrochure.findUnique({
      where: { policyId_brochureId: { policyId: id, brochureId } },
    });

    if (existing) {
      return NextResponse.json({ link: existing, message: "Brochure already linked" });
    }

    const link = await db.policyBrochure.create({
      data: { policyId: id, brochureId },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/policies/[id]/brochures] Error:", error);
    return NextResponse.json({ error: "Failed to link brochure" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "brochures:unlink");
  if (!limit.allowed) {
    return rateLimitExceeded("brochures:unlink", limit.retryAfterSeconds);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const brochureId = body?.brochureId;

    if (!brochureId || typeof brochureId !== "string") {
      return NextResponse.json({ error: "brochureId is required" }, { status: 400 });
    }

    await db.policyBrochure.deleteMany({
      where: { policyId: id, brochureId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/policies/[id]/brochures] Error:", error);
    return NextResponse.json({ error: "Failed to unlink brochure" }, { status: 500 });
  }
}
