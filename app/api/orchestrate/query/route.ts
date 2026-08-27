import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { orchestrateQuery } from "@/lib/ai/orchestrator";
import {
  checkRateLimit,
  rateLimitExceeded,
} from "@/lib/security/rateLimiter";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const rl = checkRateLimit(auth.user.sub, "orchestrate:query");
  if (!rl.allowed) return rateLimitExceeded("orchestrate:query", rl.retryAfterSeconds);

  try {
    const body = await request.json();
    const { messages, sessionId, agentId } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const response = await orchestrateQuery({
      messages,
      sessionId,
      agentId,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Orchestration query error:", error);

    return NextResponse.json(
      { error: "Orchestration failed" },
      { status: 500 }
    );
  }
}
