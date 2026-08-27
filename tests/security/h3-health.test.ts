import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    ok: true,
    user: { sub: "u1", realmRoles: [], clientRoles: [] },
  }),
}));
vi.mock("@/lib/db/health", () => ({
  checkAllHealth: vi.fn().mockResolvedValue({ postgres: true, qdrant: true }),
}));

describe("H3 — /api/health endpoint", () => {
  it("returns healthy when all services are up", async () => {
    const { GET } = await import("@/app/api/health/route");
    const req = new Request("http://localhost/api/health");
    const res = await GET(req as any);
    const body = await res.json();

    expect(body.status).toBe("healthy");
    expect(body.services.postgres).toBe(true);
    expect(body.services.qdrant).toBe(true);
    expect(body.timestamp).toBeDefined();
  });
});
