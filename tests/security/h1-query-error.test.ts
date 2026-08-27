import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    ok: true,
    user: { sub: "u1", realmRoles: [], clientRoles: [] },
  }),
}));
vi.mock("@/lib/security/rateLimiter", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
  rateLimitExceeded: vi.fn(),
}));
vi.mock("@/lib/ai/orchestrator", () => ({
  orchestrateQuery: vi.fn().mockRejectedValue(new Error("Prisma: table missing")),
}));

describe("H1 — orchestrate/query error leakage", () => {
  it("returns generic error, not internal message", async () => {
    const { POST } = await import("@/app/api/orchestrate/query/route");
    const req = new Request("http://localhost/api/orchestrate/query", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.error).toBeDefined();
    expect(body.message).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("Prisma");
    expect(JSON.stringify(body)).not.toContain("table missing");
  });
});
