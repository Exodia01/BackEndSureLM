import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { orchestrateQueryStreaming } from "@/lib/ai/orchestrator";
import {
  checkRateLimit,
  rateLimitExceeded,
} from "@/lib/security/rateLimiter";
import type { AgentMessage } from "@/lib/ai/agents/types";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const rl = checkRateLimit(auth.user.sub, "orchestrate:query");
  if (!rl.allowed) return rateLimitExceeded("orchestrate:query", rl.retryAfterSeconds);

  let body: { messages?: unknown; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: "messages array is required" },
      { status: 400 }
    );
  }

  try {
    const stream = await orchestrateQueryStreaming({
      messages: body.messages as AgentMessage[],
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Orchestration stream error:", error);

    return NextResponse.json(
      { error: "Stream failed" },
      { status: 500 }
    );
  }
}
