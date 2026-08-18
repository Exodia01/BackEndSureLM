import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { approveRequirement } from "@/lib/ai/extractRequirements";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";

/**
 * POST /api/policies/[id]/requirements/[requirementId]/approve
 *
 * ADMIN-only. Approves a draft requirement atomically: sets isDraft=false,
 * approvedAt=now, approvedBy=authenticated user's sub (never client-supplied).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requirementId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "requirements:approve");
  if (!limit.allowed) {
    return rateLimitExceeded("requirements:approve", limit.retryAfterSeconds);
  }

  try {
    const { id, requirementId } = await params;

    const requirement = await db.requirementDefinition.findUnique({
      where: { id: requirementId },
    });

    if (!requirement || requirement.policyId !== id) {
      return NextResponse.json(
        { error: "Requirement not found for this policy" },
        { status: 404 }
      );
    }

    const approved = await approveRequirement(requirementId, auth.user.sub);

    return NextResponse.json({ success: true, requirement: approved });
  } catch (error) {
    console.error("[POST /api/policies/[id]/requirements/[requirementId]/approve] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to approve requirement";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
