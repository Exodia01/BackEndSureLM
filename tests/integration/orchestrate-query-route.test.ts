import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

const mockOrchestrateQuery = vi.fn();
vi.mock("@/lib/ai/orchestrator", () => ({
  orchestrateQuery: (...args: unknown[]) => mockOrchestrateQuery(...args),
}));

const { POST } = await import("@/app/api/orchestrate/query/route");

const AGENT = { sub: "agent-1", realm_access: { roles: ["agent"] } };

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/orchestrate/query", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/orchestrate/query", () => {
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
    expect(mockOrchestrateQuery).not.toHaveBeenCalled();
  });

  it("returns 400 when messages is missing", async () => {
    const res = await POST(req({}));

    expect(res.status).toBe(400);
    expect(mockOrchestrateQuery).not.toHaveBeenCalled();
  });

  it("calls orchestrateQuery for an authenticated user", async () => {
    mockOrchestrateQuery.mockResolvedValue({
      content: "response",
      context: [],
      toolsUsed: [],
    });

    const res = await POST(
      req({ messages: [{ role: "user", content: "hi" }], sessionId: "s1" })
    );

    expect(res.status).toBe(200);
    expect(mockOrchestrateQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hi" }],
        sessionId: "s1",
      })
    );
  });

  it("returns 500 when orchestration fails", async () => {
    mockOrchestrateQuery.mockRejectedValue(new Error("orchestrator down"));

    const res = await POST(req({ messages: [{ role: "user", content: "hi" }] }));

    expect(res.status).toBe(500);
  });
});
