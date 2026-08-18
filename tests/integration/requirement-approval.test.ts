import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

const dbMock = {
  requirementDefinition: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

// Use real service logic by NOT mocking extractRequirements (the service file
// is exercised end-to-end, with db mocked underneath).
const { PATCH, DELETE } = await import(
  "@/app/api/policies/[id]/requirements/[requirementId]/route"
);
const { POST: approvePost } = await import(
  "@/app/api/policies/[id]/requirements/[requirementId]/approve/route"
);

const ADMIN = { sub: "admin-1", realm_access: { roles: ["admin"] } };
const AGENT = { sub: "agent-1", realm_access: { roles: ["agent"] } };

function req(url: string, opts: RequestInit = {}): NextRequest {
  return new NextRequest(url, opts as never);
}

const params = (id: string, requirementId: string) =>
  ({ params: Promise.resolve({ id, requirementId }) }) as any;

describe("requirement approval workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const DRAFT = {
    id: "r1",
    policyId: "p1",
    isDraft: true,
    ruleKey: "min_entry_age",
    label: "Min Entry Age",
    approvedAt: null,
  };
  const APPROVED = {
    id: "r1",
    policyId: "p1",
    isDraft: false,
    ruleKey: "min_entry_age",
    label: "Min Entry Age",
    approvedAt: new Date(),
  };

  it("AGENT cannot approve a requirement (403)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const res = await approvePost(
      req("http://localhost:3000/api/policies/p1/requirements/r1/approve", {
        method: "POST",
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(403);
    expect(dbMock.requirementDefinition.update).not.toHaveBeenCalled();
  });

  it("AGENT cannot edit a draft requirement (403)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const res = await PATCH(
      req("http://localhost:3000/api/policies/p1/requirements/r1", {
        method: "PATCH",
        body: JSON.stringify({ label: "New label" }),
        headers: { "content-type": "application/json" },
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(403);
  });

  it("AGENT cannot reject a draft requirement (403)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const res = await DELETE(
      req("http://localhost:3000/api/policies/p1/requirements/r1", {
        method: "DELETE",
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(403);
    expect(dbMock.requirementDefinition.delete).not.toHaveBeenCalled();
  });

  it("requires a valid token (401)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "No authorization header" });
    const res = await approvePost(
      req("http://localhost:3000/api/policies/p1/requirements/r1/approve", {
        method: "POST",
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when requirement belongs to another policy", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue({
      ...DRAFT,
      policyId: "OTHER",
    });
    const res = await approvePost(
      req("http://localhost:3000/api/policies/p1/requirements/r1/approve", {
        method: "POST",
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(404);
  });

  it("ADMIN approve sets approvedAt/approvedBy from auth identity (not client)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue(DRAFT);
    dbMock.requirementDefinition.findFirst.mockResolvedValue(null);
    dbMock.requirementDefinition.update.mockResolvedValue(APPROVED);

    const res = await approvePost(
      req("http://localhost:3000/api/policies/p1/requirements/r1/approve", {
        method: "POST",
        body: JSON.stringify({ approvedBy: "attacker-id" }),
        headers: { "content-type": "application/json" },
      }),
      params("p1", "r1")
    );

    expect(res.status).toBe(200);
    const updateCall = dbMock.requirementDefinition.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe("r1");
    expect(updateCall.data.isDraft).toBe(false);
    expect(updateCall.data.approvedBy).toBe("admin-1"); // from token, never "attacker-id"
    expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
  });

  it("approve rejects when policy already has an approved definition for that ruleKey", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue(DRAFT);
    dbMock.requirementDefinition.findFirst.mockResolvedValue({
      id: "r-approved",
      isDraft: false,
    });

    const res = await approvePost(
      req("http://localhost:3000/api/policies/p1/requirements/r1/approve", {
        method: "POST",
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(400);
    expect(dbMock.requirementDefinition.update).not.toHaveBeenCalled();
  });

  it("ADMIN can edit a draft requirement via PATCH without approve flag", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue(DRAFT);
    dbMock.requirementDefinition.update.mockResolvedValue({
      ...DRAFT,
      label: "New label",
      description: "18 years and above",
    });

    const res = await PATCH(
      req("http://localhost:3000/api/policies/p1/requirements/r1", {
        method: "PATCH",
        body: JSON.stringify({ label: "New label", description: "18 years and above" }),
        headers: { "content-type": "application/json" },
      }),
      params("p1", "r1")
    );

    expect(res.status).toBe(200);
    const updateCall = dbMock.requirementDefinition.update.mock.calls[0][0];
    expect(updateCall.data.label).toBe("New label");
    expect(updateCall.data.description).toBe("18 years and above");
    expect(updateCall.data.isDraft).toBeUndefined(); // approval not touched
  });

  it("cannot edit an approved requirement (400)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue(APPROVED);
    const res = await PATCH(
      req("http://localhost:3000/api/policies/p1/requirements/r1", {
        method: "PATCH",
        body: JSON.stringify({ label: "sneaky" }),
        headers: { "content-type": "application/json" },
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Approved requirements cannot be edited");
    expect(dbMock.requirementDefinition.update).not.toHaveBeenCalled();
  });

  it("ADMIN can reject (delete) a draft requirement", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue(DRAFT);
    dbMock.requirementDefinition.delete.mockResolvedValue(DRAFT);

    const res = await DELETE(
      req("http://localhost:3000/api/policies/p1/requirements/r1", {
        method: "DELETE",
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(200);
    expect(dbMock.requirementDefinition.delete).toHaveBeenCalledWith({
      where: { id: "r1" },
    });
  });

  it("cannot reject (delete) an approved requirement (400)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue(APPROVED);
    const res = await DELETE(
      req("http://localhost:3000/api/policies/p1/requirements/r1", {
        method: "DELETE",
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Approved requirements cannot be deleted");
    expect(dbMock.requirementDefinition.delete).not.toHaveBeenCalled();
  });

  it("PATCH with approve:true still approves (Phase 2 backward compat)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue(DRAFT);
    dbMock.requirementDefinition.findFirst.mockResolvedValue(null);
    dbMock.requirementDefinition.update.mockResolvedValue(APPROVED);

    const res = await PATCH(
      req("http://localhost:3000/api/policies/p1/requirements/r1", {
        method: "PATCH",
        body: JSON.stringify({ approve: true }),
        headers: { "content-type": "application/json" },
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approved).toBe(true);
    expect(dbMock.requirementDefinition.update.mock.calls[0][0].data.approvedBy).toBe("admin-1");
  });

  it("rejects edit with an empty label (400)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.requirementDefinition.findUnique.mockResolvedValue(DRAFT);
    const res = await PATCH(
      req("http://localhost:3000/api/policies/p1/requirements/r1", {
        method: "PATCH",
        body: JSON.stringify({ label: "  " }),
        headers: { "content-type": "application/json" },
      }),
      params("p1", "r1")
    );
    expect(res.status).toBe(400);
    expect(dbMock.requirementDefinition.update).not.toHaveBeenCalled();
  });
});
