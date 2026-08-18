import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import {
  approveRequirement,
  editRequirementDraft,
  rejectRequirementDraft,
} from "@/lib/ai/extractRequirements";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";

/**
 * PATCH /api/policies/[id]/requirements/[requirementId]
 *
 * Two modes, both ADMIN-only:
 *  - { approve: true }                → approve the draft requirement.
 *  - { label?, description?, validationRules? } → edit a draft requirement.
 *
 * Approved requirements cannot be edited.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requirementId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "requirements:update");
  if (!limit.allowed) {
    return rateLimitExceeded("requirements:update", limit.retryAfterSeconds);
  }

  try {
    const { id, requirementId } = await params;
    const body = await request.json();

    const requirement = await db.requirementDefinition.findUnique({
      where: { id: requirementId },
    });

    if (!requirement || requirement.policyId !== id) {
      return NextResponse.json(
        { error: "Requirement not found for this policy" },
        { status: 404 }
      );
    }

    if (body?.approve === true) {
      await approveRequirement(requirementId, auth.user.sub);
      return NextResponse.json({ success: true, approved: true });
    }

    const updated = await editRequirementDraft(requirementId, id, {
      label: body?.label,
      description: body?.description,
      validationRules: body?.validationRules,
    });

    return NextResponse.json({ success: true, requirement: updated });
  } catch (error) {
    console.error("[PATCH /api/policies/[id]/requirements/[requirementId]] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to update requirement";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/policies/[id]/requirements/[requirementId]
 *
 * Rejects (deletes) a DRAFT requirement only. Approved requirements are
 * authoritative and may be referenced by immutable RequirementSnapshots, so
 * they are never hard-deleted.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requirementId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "requirements:reject");
  if (!limit.allowed) {
    return rateLimitExceeded("requirements:reject", limit.retryAfterSeconds);
  }

  try {
    const { id, requirementId } = await params;
    await rejectRequirementDraft(requirementId, id);
    return NextResponse.json({ success: true, rejected: true });
  } catch (error) {
    console.error("[DELETE /api/policies/[id]/requirements/[requirementId]] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to reject requirement";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
