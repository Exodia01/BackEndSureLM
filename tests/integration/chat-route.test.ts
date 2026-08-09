import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockOrchestrateQuery = vi.fn();
const mockOrchestrateQueryStreaming = vi.fn();
vi.mock("@/lib/ai/orchestrator", () => ({
  orchestrateQuery: (...args: unknown[]) => mockOrchestrateQuery(...args),
  orchestrateQueryStreaming: (...args: unknown[]) => mockOrchestrateQueryStreaming(...args),
}));

const { POST } = await import("@/app/api/chat/route");

const AGENT = { sub: "agent-1", realm_access: { roles: ["agent"] } };

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ ok: true, payload: AGENT });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({ ok: false, response: unauthorized() });

    const res = await POST(req({ message: "term plan", history: [] }));

    expect(res.status).toBe(401);
    expect(mockOrchestrateQuery).not.toHaveBeenCalled();
    expect(mockOrchestrateQueryStreaming).not.toHaveBeenCalled();
  });

  it("returns 400 when no message and no messages array", async () => {
    const res = await POST(req({}));

    expect(res.status).toBe(400);
    expect(mockOrchestrateQuery).not.toHaveBeenCalled();
  });

  it("supports the dashboard contract (message + history) as an SSE stream", async () => {
    mockOrchestrateQueryStreaming.mockResolvedValue(
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Hello");
          controller.enqueue(" world");
          controller.close();
        },
      })
    );

    const res = await POST(
      req({
        message: "recommend a term plan",
        history: [
          { role: "ai", content: "Hi, I can help with that." },
          { role: "agent", content: "thanks" },
        ],
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const body = await res.text();

    expect(body).toContain('data: {"type":"token","token":"Hello"}');
    expect(body).toContain('data: {"type":"token","token":" world"}');
    expect(body).toContain(
      'data: {"type":"done","success":true,"data":{"type":"content","content":"Hello world"}}'
    );

    expect(mockOrchestrateQueryStreaming).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "assistant", content: "Hi, I can help with that." },
          { role: "user", content: "thanks" },
          { role: "user", content: "recommend a term plan" },
        ],
      })
    );
  });

  it("supports the programmatic contract (messages) as JSON when stream is false", async () => {
    mockOrchestrateQuery.mockResolvedValue({
      content: "Here are term plan options.",
      context: [],
      toolsUsed: ["policy_retriever"],
    });

    const res = await POST(
      req({
        messages: [{ role: "user", content: "compare term plans" }],
        stream: false,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.content).toContain("term plan");
    expect(mockOrchestrateQuery).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [{ role: "user", content: "compare term plans" }] })
    );
  });

  it("returns 500 when orchestration fails for JSON path", async () => {
    mockOrchestrateQuery.mockRejectedValue(new Error("orchestrator down"));

    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }], stream: false })
    );

    expect(res.status).toBe(500);
  });
});
