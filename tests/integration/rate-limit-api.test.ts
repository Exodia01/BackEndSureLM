import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimiter";

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {
    policy: {
      findUnique: vi.fn().mockResolvedValue({ id: "p1" }),
    },
  },
}));

vi.mock("@/lib/ai/services/policyVersioning", () => ({
  publishPolicyVersion: vi.fn().mockResolvedValue({
    version: { id: "v1", versionNum: 1 },
    snapshot: { id: "s1" },
  }),
  listPolicyVersions: vi.fn(),
}));

const { POST: publishVersion } = await import("@/app/api/policies/[id]/versions/route");

function req(url: string, opts: RequestInit = {}): NextRequest {
  return new NextRequest(url, opts as never);
}

describe("rate limiting on admin mutation endpoints (429)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes up to the limit then returns 429", async () => {
    const sub = `rate-a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    mockValidateAuth.mockResolvedValue({
      valid: true,
      payload: { sub, realm_access: { roles: ["admin"] } },
    });
    const limit = RATE_LIMITS["versions:publish"].limit;

    for (let i = 0; i < limit; i++) {
      const res = await publishVersion(
        req("http://localhost:3000/api/policies/p1/versions", {
          method: "POST",
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ id: "p1" }) } as any
      );
      expect(res.status).toBe(201);
    }

    const res = await publishVersion(
      req("http://localhost:3000/api/policies/p1/versions", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = await res.json();
    expect(body.error).toBe("Rate limit exceeded");
    expect(body.action).toBe("versions:publish");
  });

  it("429 is returned only AFTER admin authorization (agent gets 403, not 429)", async () => {
    const sub = `rate-ag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    mockValidateAuth.mockResolvedValue({
      valid: true,
      payload: { sub, realm_access: { roles: ["agent"] } },
    });
    // Exhaust the agent's bucket; auth must still gate first.
    const limit = RATE_LIMITS["versions:publish"].limit;
    for (let i = 0; i < limit; i++) checkRateLimit(sub, "versions:publish");

    const res = await publishVersion(
      req("http://localhost:3000/api/policies/p1/versions", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(403);
  });
});
