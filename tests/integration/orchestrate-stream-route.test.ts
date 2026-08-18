import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockOrchestrateQueryStreaming = vi.fn();
vi.mock("@/lib/ai/orchestrator", () => ({
  orchestrateQueryStreaming: (...args: unknown[]) => mockOrchestrateQueryStreaming(...args),
}));

const { POST } = await import("@/app/api/orchestrate/query-stream/route");

const AGENT = { sub: "agent-1", realm_access: { roles: ["agent"] } };

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/orchestrate/query-stream", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/orchestrate/query-stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ ok: true, user: AGENT });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAuth.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    });

    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));

    expect(res.status).toBe(401);
    expect(mockOrchestrateQueryStreaming).not.toHaveBeenCalled();
  });

  it("returns 400 when messages is missing", async () => {
    const res = await POST(req({}));

    expect(res.status).toBe(400);
    expect(mockOrchestrateQueryStreaming).not.toHaveBeenCalled();
  });

  it("streams the orchestrated text stream", async () => {
    mockOrchestrateQueryStreaming.mockResolvedValue(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("chunk-one"));
          controller.close();
        },
      })
    );

    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }], sessionId: "s1" })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe("chunk-one");
    expect(mockOrchestrateQueryStreaming).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hi" }],
        sessionId: "s1",
      })
    );
  });

  it("returns 500 when streaming fails", async () => {
    mockOrchestrateQueryStreaming.mockRejectedValue(new Error("stream broke"));

    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));

    expect(res.status).toBe(500);
  });
});
