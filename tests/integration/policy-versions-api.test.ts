import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

const dbMock = {
  policy: {
    findUnique: vi.fn(),
  },
  policyVersion: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { GET } = await import("@/app/api/policies/[id]/versions/route");

const ADMIN = { sub: "admin-1", realm_access: { roles: ["admin"] } };
const AGENT = { sub: "agent-1", realm_access: { roles: ["agent"] } };

function req(url: string, opts: RequestInit = {}): NextRequest {
  return new NextRequest(url, opts as never);
}

describe("policy versions read API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a valid token (401)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "No authorization header" });
    const res = await GET(
      req("http://localhost:3000/api/policies/p1/versions"),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(401);
  });

  it("allows AGENT to read versions (read-only)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1", currentVersionId: "v2" });
    dbMock.policyVersion.findMany.mockResolvedValue([
      {
        id: "v2",
        versionNum: 2,
        label: "v2",
        isCurrent: true,
        publishedAt: new Date("2026-08-01"),
        publishedBy: "admin-1",
        snapshot: {
          id: "s2",
          requirements: [{ ruleKey: "min_entry_age", label: "Min Entry Age" }],
        },
      },
      {
        id: "v1",
        versionNum: 1,
        label: "v1",
        isCurrent: false,
        publishedAt: new Date("2026-07-01"),
        publishedBy: "admin-1",
        snapshot: {
          id: "s1",
          requirements: [{ ruleKey: "min_sum_assured", label: "Min Sum Assured" }],
        },
      },
    ]);

    const res = await GET(
      req("http://localhost:3000/api/policies/p1/versions"),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.versions).toHaveLength(2);
    expect(body.versions[0].isCurrent).toBe(true);
    expect(body.versions[1].isCurrent).toBe(false);
    // Immutable snapshot is present and not modified.
    expect(body.versions[0].snapshot.requirements[0].ruleKey).toBe("min_entry_age");
  });

  it("marks versions current only when matching policy.currentVersionId", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1", currentVersionId: "v3" });
    dbMock.policyVersion.findMany.mockResolvedValue([
      { id: "v3", versionNum: 3, snapshot: null },
      { id: "v2", versionNum: 2, snapshot: null },
    ]);
    const res = await GET(
      req("http://localhost:3000/api/policies/p1/versions"),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    const body = await res.json();
    expect(body.versions[0].isCurrent).toBe(true);
    expect(body.versions[1].isCurrent).toBe(false);
  });

  it("returns 404 for a missing policy", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    dbMock.policy.findUnique.mockResolvedValue(null);
    const res = await GET(
      req("http://localhost:3000/api/policies/p1/versions"),
      { params: Promise.resolve({ id: "p1" }) } as any
    );
    expect(res.status).toBe(404);
  });
});
