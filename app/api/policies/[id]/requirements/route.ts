import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { extractRequirements, listPolicyRequirements } from "@/lib/ai/extractRequirements";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const drafts = searchParams.get("drafts") !== "false";
    const approvedOnly = searchParams.get("approvedOnly") === "true";

    const policy = await db.policy.findUnique({ where: { id } });
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const requirements = await listPolicyRequirements(
      id,
      approvedOnly ? false : drafts
    );

    return NextResponse.json({ requirements });
  } catch (error) {
    console.error("[GET /api/policies/[id]/requirements] Error:", error);
    return NextResponse.json({ error: "Failed to fetch requirements" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "requirements:extract");
  if (!limit.allowed) {
    return rateLimitExceeded("requirements:extract", limit.retryAfterSeconds);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const brochureId = body?.brochureId;

    if (!brochureId || typeof brochureId !== "string") {
      return NextResponse.json({ error: "brochureId is required" }, { status: 400 });
    }

    const result = await extractRequirements(brochureId, id);

    return NextResponse.json(
      { success: true, ...result },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/policies/[id]/requirements] Error:", error);
    return NextResponse.json({ error: "Failed to extract requirements" }, { status: 400 });
  }
}
