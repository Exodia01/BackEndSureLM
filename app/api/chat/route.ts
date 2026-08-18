import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import {
  orchestrateQuery,
  orchestrateQueryStreaming,
  type OrchestratorResponse,
} from "@/lib/ai/orchestrator";
import {
  checkRateLimit,
  rateLimitExceeded,
} from "@/lib/security/rateLimiter";

const encoder = new TextEncoder();

interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

interface NormalizedRequest {
  messages: ChatTurn[];
  sessionId?: string;
  wantsStream: boolean;
}

/**
 * Normalize the two supported request shapes into the orchestrator contract:
 *
 * 1. Programmatic shape:  { messages, sessionId?, stream? }
 * 2. Dashboard UI shape:  { message, history?: [{ role, content }] }
 *
 * The dashboard labels user turns as "agent" and assistant turns as "ai";
 * both are mapped onto the orchestrator's canonical user/assistant roles.
 */
function normalizeRequest(body: Record<string, unknown>): NormalizedRequest | null {
  if (Array.isArray(body.messages)) {
    const messages: ChatTurn[] = (body.messages as Array<{ role?: string; content?: unknown }>)
      .map((m) => {
        const role: ChatTurn["role"] =
          m.role === "system" ? "system" : m.role === "assistant" || m.role === "ai" ? "assistant" : "user";
        return { role, content: typeof m.content === "string" ? m.content : "" };
      })
      .filter((m) => m.content.length > 0);

    if (messages.length === 0) return null;

    return {
      messages,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      wantsStream: body.stream === true,
    };
  }

  if (typeof body.message === "string" && body.message.trim().length > 0) {
    const history = Array.isArray(body.history) ? (body.history as Array<{ role?: string; content?: unknown }>) : [];
    const priorTurns: ChatTurn[] = history
      .map((m) => {
        const role: ChatTurn["role"] =
          m.role === "ai" ? "assistant" : m.role === "system" ? "system" : "user";
        return { role, content: typeof m.content === "string" ? m.content : "" };
      })
      .filter((m) => m.content.length > 0);

    return {
      messages: [...priorTurns, { role: "user", content: body.message.trim() }],
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      wantsStream: true,
    };
  }

  return null;
}

/**
 * Wraps the orchestrator's text stream as an SSE stream matching the dashboard
 * consumer: `data: {"type":"token","token":"..."}` frames followed by a single
 * `data: {"type":"done","success":true,"data":{"type":"content","content":"..."}}`
 * frame.
 */
function toSSEStream(source: ReadableStream, fallbackContent: string): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  const frame = (payload: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let hadError = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const text =
            typeof value === "string"
              ? value
              : value instanceof Uint8Array
                ? decoder.decode(value, { stream: true })
                : String(value);
          accumulated += text;
          controller.enqueue(frame({ type: "token", token: text }));
        }
      } catch {
        hadError = true;
      } finally {
        const content = accumulated.length > 0 ? accumulated : fallbackContent;
        controller.enqueue(
          frame({
            type: "done",
            success: !hadError,
            data: { type: "content", content },
          })
        );
        controller.close();
      }
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const rl = checkRateLimit(auth.user.sub, "chat:send");
  if (!rl.allowed) return rateLimitExceeded("chat:send", rl.retryAfterSeconds);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeRequest(body);
  if (!normalized) {
    return NextResponse.json(
      { error: "a `message` string or a non-empty `messages` array is required" },
      { status: 400 }
    );
  }

  const { messages, sessionId, wantsStream } = normalized;

  try {
    if (wantsStream) {
      const source = await orchestrateQueryStreaming({ messages, sessionId });
      const sseStream = toSSEStream(source, "Sorry, I couldn't process that. Please try again.");
      return new Response(sseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const response: OrchestratorResponse = await orchestrateQuery({ messages, sessionId });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Chat orchestration error:", error);
    return NextResponse.json({ error: "Chat orchestration failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "orchestration-api",
  });
}
