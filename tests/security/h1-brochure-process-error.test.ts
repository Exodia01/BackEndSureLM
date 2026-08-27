import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    ok: true,
    user: { sub: "u1", realmRoles: ["admin"], clientRoles: [] },
  }),
}));
vi.mock("@/lib/security/rateLimiter", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
  rateLimitExceeded: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { brochure: { findUnique: vi.fn().mockRejectedValue(new Error("Connection refused at 127.0.0.1:5432")) } },
}));

describe("H1 — brochure process error leakage", () => {
  it("returns generic error, not internal message", async () => {
    const { POST } = await import("@/app/api/brochures/[id]/process/route");
    const req = new Request("http://localhost/api/brochures/b1/process", { method: "POST" });
    const res = await POST(req as any, { params: Promise.resolve({ id: "b1" }) });
    const body = await res.json();

    expect(body.error).toBeDefined();
    expect(body.message).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("Connection refused");
    expect(JSON.stringify(body)).not.toContain("127.0.0.1");
  });
});
