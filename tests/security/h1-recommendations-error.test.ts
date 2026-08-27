import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    ok: true,
    user: { sub: "u1", realmRoles: [], clientRoles: [] },
  }),
}));
vi.mock("@/lib/ai/generateRecommendations", () => ({
  generateRecommendations: vi.fn().mockRejectedValue(new Error("OLLAMA_HOST unreachable")),
}));

describe("H1 — recommendations error leakage", () => {
  it("returns generic error, not internal message", async () => {
    const { POST } = await import("@/app/api/recommendations/route");
    const req = new Request("http://localhost/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ query: "term life for 30yo" }),
    });
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.error).toBeDefined();
    expect(body.message).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("OLLAMA_HOST");
    expect(JSON.stringify(body)).not.toContain("unreachable");
  });
});
