import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get("includeInactive") === "true";

    const policies = await db.policy.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { brochures: true, versions: true } },
      },
    });

    return NextResponse.json({ policies });
  } catch (error) {
    console.error("[GET /api/policies] Error:", error);
    return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const limit = checkRateLimit(auth.user.sub, "policies:create");
  if (!limit.allowed) {
    return rateLimitExceeded("policies:create", limit.retryAfterSeconds);
  }

  try {
    const body = await request.json();
    const { name, provider, category, allowReuse } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Policy name is required" }, { status: 400 });
    }

    const policy = await db.policy.create({
      data: {
        name: name.trim(),
        provider: provider ? String(provider) : null,
        category: category ? String(category) : null,
        allowReuse: allowReuse === true,
      },
    });

    return NextResponse.json({ policy }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/policies] Error:", error);
    return NextResponse.json({ error: "Failed to create policy" }, { status: 500 });
  }
}
