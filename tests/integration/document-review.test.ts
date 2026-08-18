import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { RATE_LIMITS } from "@/lib/security/rateLimiter";

const mockValidateAuth = vi.fn();
const mockEnsureUserInDb = vi.fn();

vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
  ensureUserInDb: (...args: unknown[]) => mockEnsureUserInDb(...args),
}));

const dbMock = {
  customerDocument: { findFirst: vi.fn(), updateMany: vi.fn() },
  documentValidationReport: { updateMany: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { POST: reviewPOST, reviewDocument } = await import("@/app/api/documents/[id]/review/route");

const AGENT_A = {
  sub: "agent-a",
  email: "a@example.com",
  name: "Agent A",
  realm_access: { roles: ["agent"] },
  resource_access: { "web-app": { roles: [] } },
};

function makeOwnedDoc(status: string, ownerId = "DB_A") {
  return {
    id: "doc-1",
    status,
    application: { lead: { id: "lead-1", agentId: ownerId } },
  };
}

function req(url: string, opts: RequestInit = {}): NextRequest {
  return new NextRequest(url, opts as never);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) }) as any;

async function review(body: Record<string, unknown>, docId = "doc-1") {
  return reviewPOST(
    req(`http://localhost:3000/api/documents/${docId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    params(docId)
  );
}

describe("POST /api/documents/:id/review (CAS hardening)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUserInDb.mockResolvedValue({ id: "DB_A", keycloakId: "agent-a" });
    dbMock.customerDocument.updateMany.mockResolvedValue({ count: 1 });
    dbMock.documentValidationReport.updateMany.mockResolvedValue({ count: 1 });
    dbMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  });

  it("approve → VALIDATED + report PASS with reviewer recorded", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED"));

    const res = await review({ verdict: "approve" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ id: "doc-1", status: "VALIDATED", verdict: "approve" });

    expect(dbMock.customerDocument.updateMany).toHaveBeenCalledWith({
      where: { id: "doc-1", status: "REVIEW_REQUIRED" },
      data: { status: "VALIDATED" },
    });
    expect(dbMock.documentValidationReport.updateMany).toHaveBeenCalledWith({
      where: { documentId: "doc-1", status: "REVIEW_REQUIRED" },
      data: expect.objectContaining({
        status: "PASS",
        reviewedById: "DB_A",
        reviewNotes: null,
      }),
    });
    expect(dbMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "document.reviewed", entityId: "doc-1" }),
      })
    );
  });

  it("reject → REJECTED + report FAIL with trimmed notes required", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED"));

    const res = await review({ verdict: "reject", notes: "   Declined: forged signature  " });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ id: "doc-1", status: "REJECTED", verdict: "reject" });

    expect(dbMock.documentValidationReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: "doc-1", status: "REVIEW_REQUIRED" },
        data: expect.objectContaining({ status: "FAIL", reviewNotes: "Declined: forged signature" }),
      })
    );
  });

  it("reject without notes → 400 and NO database write", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED"));

    const res = await review({ verdict: "reject" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Notes are required");
    expect(dbMock.customerDocument.updateMany).not.toHaveBeenCalled();
    expect(dbMock.documentValidationReport.updateMany).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("reject with whitespace-only notes → 400 and NO database write", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED"));

    const res = await review({ verdict: "reject", notes: "   " });
    expect(res.status).toBe(400);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("invalid verdict → 400", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED"));

    const res = await review({ verdict: "maybe" });
    expect(res.status).toBe(400);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("document no longer REVIEW_REQUIRED (CAS lost) → 409", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED"));
    dbMock.customerDocument.updateMany.mockResolvedValue({ count: 0 });

    const res = await review({ verdict: "approve" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already decided");
  });

  it("report already deterministically decided (override attempt) → 409", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED"));
    dbMock.documentValidationReport.updateMany.mockResolvedValue({ count: 0 });

    const res = await review({ verdict: "approve" });
    expect(res.status).toBe(409);
    expect(dbMock.customerDocument.updateMany).toHaveBeenCalled();
  });

  it("document already decided (VALIDATED) → 409 before any write", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("VALIDATED"));

    const res = await review({ verdict: "approve" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("not awaiting review");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("cross-agent review → 403 (IDOR), no write", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED", "OTHER_AGENT"));

    const res = await review({ verdict: "approve" });
    expect(res.status).toBe(403);
    expect(dbMock.customerDocument.updateMany).not.toHaveBeenCalled();
    expect(dbMock.documentValidationReport.updateMany).not.toHaveBeenCalled();
  });

  it("returns 429 once the review limit is exceeded", async () => {
    const sub = `rev-rate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    mockValidateAuth.mockResolvedValue({ valid: true, payload: { ...AGENT_A, sub } });
    dbMock.customerDocument.findFirst.mockResolvedValue(makeOwnedDoc("REVIEW_REQUIRED"));

    const limit = RATE_LIMITS["documents:review"].limit;
    for (let i = 0; i < limit; i++) {
      const res = await review({ verdict: "approve" });
      expect(res.status).toBe(200);
    }

    const res = await review({ verdict: "approve" });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.action).toBe("documents:review");
  });
});

describe("reviewDocument (exported helper) — CAS semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops));
  });

  it("applies both guarded updates atomically", async () => {
    dbMock.customerDocument.updateMany.mockResolvedValue({ count: 1 });
    dbMock.documentValidationReport.updateMany.mockResolvedValue({ count: 1 });

    const status = await reviewDocument({ userId: "DB_A", documentId: "doc-1", verdict: "approve" });
    expect(status).toBe("VALIDATED");

    expect(dbMock.customerDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "doc-1", status: "REVIEW_REQUIRED" } })
    );
    expect(dbMock.documentValidationReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentId: "doc-1", status: "REVIEW_REQUIRED" } })
    );
  });

  it("throws when the document CAS wins the race for another reviewer", async () => {
    dbMock.customerDocument.updateMany.mockResolvedValue({ count: 0 });
    dbMock.documentValidationReport.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      reviewDocument({ userId: "DB_A", documentId: "doc-1", verdict: "approve" })
    ).rejects.toThrow("already decided");
  });
});
