import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { checkAllHealth } from "@/lib/db/health";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const health = await checkAllHealth();
  const healthy = health.postgres && health.qdrant;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        postgres: health.postgres,
        qdrant: health.qdrant,
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
