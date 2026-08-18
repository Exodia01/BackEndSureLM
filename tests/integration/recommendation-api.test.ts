import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

const mockGenerateRecommendations = vi.fn();
vi.mock("@/lib/ai/generateRecommendations", () => ({
  generateRecommendations: (...args: unknown[]) => mockGenerateRecommendations(...args),
}));

const { POST } = await import("@/app/api/recommendations/route");

const ADMIN = { sub: "admin-1", realm_access: { roles: ["admin"] } };
const AGENT = { sub: "agent-1", realm_access: { roles: ["agent"] } };

function req(url: string, opts: RequestInit = {}): NextRequest {
  return new NextRequest(url, opts as never);
}

describe("recommendations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a valid token (401)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "No authorization header" });
    const res = await POST(req("http://localhost:3000/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ query: "term plan" }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(401);
    expect(mockGenerateRecommendations).not.toHaveBeenCalled();
  });

  it("requires query (400)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const res = await POST(req("http://localhost:3000/api/recommendations", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(400);
    expect(mockGenerateRecommendations).not.toHaveBeenCalled();
  });

  it("allows authenticated AGENT and passes structured customer context", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    mockGenerateRecommendations.mockResolvedValue({
      recommendations: [],
      insufficientPolicyInformation: true,
      insufficientCustomerInformation: false,
    });

    const res = await POST(req("http://localhost:3000/api/recommendations", {
      method: "POST",
      body: JSON.stringify({
        query: "which policy for a 30yo earning 50000",
        customerContext: { age: 30, income: 50000, familySize: 4, goals: ["life_cover"] },
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(res.status).toBe(200);
    expect(mockGenerateRecommendations).toHaveBeenCalledWith(
      "which policy for a 30yo earning 50000",
      { age: 30, income: 50000, familySize: 4, existingPolicies: undefined, goals: ["life_cover"] }
    );
    const body = await res.json();
    expect(body.insufficientPolicyInformation).toBe(true);
  });

  it("returns recommendations with evidence-grounded structure", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    mockGenerateRecommendations.mockResolvedValue({
      recommendations: [
        {
          policyId: "p1",
          policyName: "Kotak Premier Life",
          provider: "Kotak",
          suitabilityScore: 0.8,
          suitabilityLabel: "model_derived",
          reasoning: "Matches customer age band.",
          features: ["Entry age 18-65"],
          requirements: [{ ruleKey: "min_entry_age", label: "Minimum Entry Age" }],
          concerns: [],
          citations: [{ chunkId: "c1", brochureId: "b1", policyId: "p1" }],
        },
      ],
      insufficientPolicyInformation: false,
      insufficientCustomerInformation: false,
    });

    const res = await POST(req("http://localhost:3000/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ query: "term plan", customerContext: { age: 30 } }),
      headers: { "content-type": "application/json" },
    }));
    const body = await res.json();
    expect(body.recommendations[0].suitabilityLabel).toBe("model_derived");
    expect(body.recommendations[0].citations[0].policyId).toBe("p1");
  });

  it("coerces non-number customer context safely", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    mockGenerateRecommendations.mockResolvedValue({
      recommendations: [],
      insufficientPolicyInformation: true,
      insufficientCustomerInformation: true,
    });

    const res = await POST(req("http://localhost:3000/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ query: "q", customerContext: { age: "30" } }),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(200);
    expect(mockGenerateRecommendations).toHaveBeenCalledWith("q", expect.objectContaining({ age: undefined }));
  });
});
