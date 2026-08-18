import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

const dbMock = {
  policy: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  policyIssuance: {
    count: vi.fn(),
  },
  policyBrochure: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  brochure: {
    findUnique: vi.fn(),
  },
  requirementDefinition: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  policyVersion: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  requirementSnapshot: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/ai/extractRequirements", () => ({
  extractRequirements: vi.fn(),
  listPolicyRequirements: vi.fn(),
  approveRequirement: vi.fn(),
}));

vi.mock("@/lib/ai/services/policyVersioning", () => ({
  publishPolicyVersion: vi.fn(),
  listPolicyVersions: vi.fn(),
}));

const { GET: listPolicies, POST: createPolicy } = await import("@/app/api/policies/route");
const { POST: linkBrochure } = await import("@/app/api/policies/[id]/brochures/route");
const { POST: extractReq } = await import("@/app/api/policies/[id]/requirements/route");
const { POST: publishVersion } = await import("@/app/api/policies/[id]/versions/route");
const { DELETE: deletePolicy } = await import("@/app/api/policies/[id]/route");

const ADMIN = { sub: "admin-1", realm_access: { roles: ["admin"] } };
const AGENT = { sub: "agent-1", realm_access: { roles: ["agent"] } };

function req(url: string, opts: RequestInit = {}): NextRequest {
  return new NextRequest(url, opts as never);
}

describe("policy API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/policies requires admin (403 for agent)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const res = await createPolicy(
      req("http://localhost:3000/api/policies", {
        method: "POST",
        body: JSON.stringify({ name: "Kotak Term" }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("POST /api/policies creates a policy for admin", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.policy.create.mockResolvedValue({ id: "p1", name: "Kotak Term" });
    const res = await createPolicy(
      req("http://localhost:3000/api/policies", {
        method: "POST",
        body: JSON.stringify({ name: "Kotak Term" }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.policy.id).toBe("p1");
  });

  it("POST /api/policies validates that name is required", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    const res = await createPolicy(
      req("http://localhost:3000/api/policies", {
        method: "POST",
        body: JSON.stringify({ name: "  " }),
        headers: { "content-type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });

  it("GET /api/policies requires a token", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "No authorization header" });
    const res = await listPolicies(req("http://localhost:3000/api/policies"));
    expect(res.status).toBe(401);
  });

  it("POST link brochure requires brochureId", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    const res = await linkBrochure(
      req("http://localhost:3000/api/policies/p1/brochures", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(400);
  });

  it("POST link brochure links an existing brochure", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1" });
    dbMock.policyBrochure.findUnique.mockResolvedValue(null);
    dbMock.policyBrochure.create.mockResolvedValue({ id: "link1" });
    const res = await linkBrochure(
      req("http://localhost:3000/api/policies/p1/brochures", {
        method: "POST",
        body: JSON.stringify({ brochureId: "b1" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(201);
    expect(dbMock.policyBrochure.create).toHaveBeenCalledWith({
      data: { policyId: "p1", brochureId: "b1" },
    });
  });

  it("POST extract requirements calls the extraction service", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    const { extractRequirements } = await import("@/lib/ai/extractRequirements");
    (extractRequirements as ReturnType<typeof vi.fn>).mockResolvedValue({
      draftsCreated: 3,
      requirements: [],
    });
    const res = await extractReq(
      req("http://localhost:3000/api/policies/p1/requirements", {
        method: "POST",
        body: JSON.stringify({ brochureId: "b1" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.draftsCreated).toBe(3);
  });

  it("POST publish version requires admin and returns a version", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    const { publishPolicyVersion } = await import("@/lib/ai/services/policyVersioning");
    (publishPolicyVersion as ReturnType<typeof vi.fn>).mockResolvedValue({
      version: { id: "v1", versionNum: 1 },
      snapshot: { id: "s1" },
    });
    const res = await publishVersion(
      req("http://localhost:3000/api/policies/p1/versions", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.snapshotId).toBe("s1");
  });

  it("DELETE /api/policies/[id] is blocked (409) when the policy has issued customer policies", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1", name: "Kotak Term" });
    dbMock.policyIssuance.count.mockResolvedValue(3);

    const res = await deletePolicy(
      req("http://localhost:3000/api/policies/p1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "p1" }) } as any
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("issued customer policies");
    expect(body.issuanceCount).toBe(3);
    // Historical issuance/audit integrity is preserved: nothing is deleted.
    expect(dbMock.policy.delete).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("DELETE /api/policies/[id] proceeds when no issued customer policies reference it", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p2", name: "Draft Policy" });
    dbMock.policyIssuance.count.mockResolvedValue(0);
    dbMock.$transaction.mockResolvedValue([]);
    dbMock.policy.delete.mockResolvedValue({ id: "p2" });

    const res = await deletePolicy(
      req("http://localhost:3000/api/policies/p2", { method: "DELETE" }),
      { params: Promise.resolve({ id: "p2" }) } as any
    );

    expect(res.status).toBe(200);
    expect(dbMock.policyIssuance.count).toHaveBeenCalledWith({
      where: { policyName: "Draft Policy" },
    });
    expect(dbMock.policy.delete).toHaveBeenCalledWith({ where: { id: "p2" } });
  });

  it("DELETE /api/policies/[id] requires admin (403 for agent)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const res = await deletePolicy(
      req("http://localhost:3000/api/policies/p1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(403);
    expect(dbMock.policy.delete).not.toHaveBeenCalled();
  });
});
