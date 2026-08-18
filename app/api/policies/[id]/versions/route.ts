import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { publishPolicyVersion, listPolicyVersions } from "@/lib/ai/services/policyVersioning";
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

    const versions = await listPolicyVersions(id);

    return NextResponse.json({ versions });
  } catch (error) {
    console.error("[GET /api/policies/[id]/versions] Error:", error);
    return NextResponse.json({ error: "Failed to fetch versions" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "versions:publish");
  if (!limit.allowed) {
    return rateLimitExceeded("versions:publish", limit.retryAfterSeconds);
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const policy = await db.policy.findUnique({ where: { id } });
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const { version, snapshot } = await publishPolicyVersion({
      policyId: id,
      label: body?.label,
      publishedBy: auth.user.sub,
    });

    return NextResponse.json(
      { success: true, version, snapshotId: snapshot.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/policies/[id]/versions] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to publish version";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
