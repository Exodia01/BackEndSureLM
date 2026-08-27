import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    ok: true,
    user: { sub: "u1", realmRoles: [], clientRoles: [] },
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    brochure: {
      findUnique: vi.fn().mockResolvedValue({
        id: "b1",
        basename: "policy",
        originalName: "policy.pdf",
        currentPage: 1,
        totalPages: 10,
        status: "READY",
        versionNum: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    },
  },
}));
vi.mock("fs/promises", () => ({ default: {} }));

describe("H2 — filePath not exposed in brochure response", () => {
  it("brochure GET response does not contain filePath", async () => {
    const { GET } = await import("@/app/api/brochures/[id]/route");
    const req = new Request("http://localhost/api/brochures/b1");
    const res = await GET(req as any, { params: Promise.resolve({ id: "b1" }) });
    const body = await res.json();

    expect(body.filePath).toBeUndefined();
    expect(body.id).toBe("b1");
    expect(body.basename).toBe("policy");
  });
});
