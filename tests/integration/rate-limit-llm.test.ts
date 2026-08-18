import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
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

const { POST: chatPOST } = await import("@/app/api/chat/route");
const { POST: queryPOST } = await import("@/app/api/orchestrate/query/route");

const AGENT = { sub: "agent-rate-test", realm_access: { roles: ["agent"] } };

function req(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("rate limiting on LLM endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ ok: true, user: AGENT });
    mockOrchestrateQuery.mockResolvedValue({ content: "ok", context: [], toolsUsed: [] });
    mockOrchestrateQueryStreaming.mockResolvedValue(
      new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("ok")); c.close(); } })
    );
  });

  it("POST /api/chat returns 429 after exceeding chat:send limit", async () => {
    // Exhaust the limit with a unique subject per test run to avoid collisions
    const sub = `chat-rl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub, realm_access: { roles: ["agent"] } } });

    // Import fresh to get the rate limiter module state
    const { checkRateLimit, RATE_LIMITS } = await import("@/lib/security/rateLimiter");
    const limit = RATE_LIMITS["chat:send"].limit;

    for (let i = 0; i < limit; i++) {
      const res = await chatPOST(
        req("http://localhost:3000/api/chat", {
          messages: [{ role: "user", content: "hi" }],
          stream: false,
        })
      );
      expect(res.status).toBe(200);
    }

    const res = await chatPOST(
      req("http://localhost:3000/api/chat", {
        messages: [{ role: "user", content: "hi" }],
        stream: false,
      })
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Rate limit exceeded");
    expect(body.action).toBe("chat:send");
  });

  it("POST /api/orchestrate/query returns 429 after exceeding orchestrate:query limit", async () => {
    const sub = `orch-rl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    mockRequireAuth.mockResolvedValue({ ok: true, user: { sub, realm_access: { roles: ["agent"] } } });

    const { RATE_LIMITS } = await import("@/lib/security/rateLimiter");
    const limit = RATE_LIMITS["orchestrate:query"].limit;

    for (let i = 0; i < limit; i++) {
      const res = await queryPOST(
        req("http://localhost:3000/api/orchestrate/query", {
          messages: [{ role: "user", content: "hi" }],
        })
      );
      expect(res.status).toBe(200);
    }

    const res = await queryPOST(
      req("http://localhost:3000/api/orchestrate/query", {
        messages: [{ role: "user", content: "hi" }],
      })
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Rate limit exceeded");
    expect(body.action).toBe("orchestrate:query");
  });
});
