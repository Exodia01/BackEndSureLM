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

    const policy = await db.policy.findUnique({
      where: { id },
      include: {
        brochures: { include: { brochure: true } },
        versions: { orderBy: { versionNum: "desc" }, include: { snapshot: true } },
        currentVersion: true,
      },
    });

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    return NextResponse.json({ policy });
  } catch (error) {
    console.error("[GET /api/policies/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to fetch policy" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "policies:update");
  if (!limit.allowed) {
    return rateLimitExceeded("policies:update", limit.retryAfterSeconds);
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const policy = await db.policy.findUnique({ where: { id } });
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.provider !== undefined) data.provider = body.provider ? String(body.provider) : null;
    if (body.category !== undefined) data.category = body.category ? String(body.category) : null;
    if (body.allowReuse !== undefined) data.allowReuse = body.allowReuse === true;
    if (body.isActive !== undefined) data.isActive = body.isActive === true;

    const updated = await db.policy.update({
      where: { id },
      data,
    });

    return NextResponse.json({ policy: updated });
  } catch (error) {
    console.error("[PATCH /api/policies/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to update policy" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "policies:delete");
  if (!limit.allowed) {
    return rateLimitExceeded("policies:delete", limit.retryAfterSeconds);
  }

  try {
    const { id } = await params;

    const policy = await db.policy.findUnique({ where: { id } });
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    // E5 hardening: never destroy historical issuance/audit integrity.
    // PolicyIssuance references policies by name (no FK), so block deletion
    // when any issued customer policy carries this policy's name. Returning
    // 409 keeps the immutable issuance history intact and requires the admin
    // to re-home or archive the policy instead of hard-deleting it.
    const issuanceCount = await db.policyIssuance.count({
      where: { policyName: policy.name },
    });
    if (issuanceCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete policy: it has issued customer policies. Archive the policy instead to preserve issuance history.",
          issuanceCount,
        },
        { status: 409 }
      );
    }

    await db.$transaction([
      db.requirementSnapshot.deleteMany({ where: { policyId: id } }),
      db.requirementDefinition.deleteMany({ where: { policyId: id } }),
      db.policyVersion.deleteMany({ where: { policyId: id } }),
      db.policyBrochure.deleteMany({ where: { policyId: id } }),
    ]);

    await db.policy.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/policies/[id]] Error:", error);
    return NextResponse.json({ error: "Failed to delete policy" }, { status: 500 });
  }
}
