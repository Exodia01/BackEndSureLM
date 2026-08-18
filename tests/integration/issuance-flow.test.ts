import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const mockValidateAuth = vi.fn();
const mockEnsureUserInDb = vi.fn();
const llmMock = vi.fn();

vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
  ensureUserInDb: (...args: unknown[]) => mockEnsureUserInDb(...args),
}));

const dbMock = {
  user: { findUnique: vi.fn() },
  policyLead: { findFirst: vi.fn(), update: vi.fn() },
  policy: { findFirst: vi.fn(), create: vi.fn() },
  policyVersion: { findUnique: vi.fn() },
  requirementSnapshot: { findUnique: vi.fn() },
  application: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  policyIssuance: { create: vi.fn(), findFirst: vi.fn() },
  customerDocument: { findUnique: vi.fn(), create: vi.fn() },
  documentValidationReport: { upsert: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/ai/agents/llm", () => ({
  generateLLMResponse: (...args: unknown[]) => llmMock(...args),
}));

vi.mock("@/lib/documents/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/documents/storage")>();
  return {
    ...actual,
    getDocumentStorage: () => ({
      put: async () => "documents/ab/cd/test.png",
      get: async () => null,
      delete: async () => {},
      exists: async () => false,
      root: "/tmp/surelm-test",
    }),
  };
});

vi.mock("@/lib/documents/jobs", () => ({
  enqueueDocumentJob: vi.fn(async () => ({ id: "job-1", status: "PENDING" })),
}));

const { POST: createApplicationPOST } = await import("@/app/api/applications/route");
const { POST: submitApplicationPOST } = await import("@/app/api/applications/[id]/submit/route");
const { POST: approveApplicationPOST } = await import("@/app/api/applications/[id]/approve/route");
const { POST: rejectApplicationPOST } = await import("@/app/api/applications/[id]/reject/route");
const { POST: issuancePOST } = await import("@/app/api/issuances/route");
const { POST: uploadDocumentPOST } = await import("@/app/api/documents/route");
const { validateDocument } = await import("@/lib/documents/validate");
import type { DocumentExtractionRecord } from "@/lib/documents/schemas";

const AGENT_A = {
  sub: "agent-a",
  email: "a@example.com",
  name: "Agent A",
  realm_access: { roles: ["agent"] },
  resource_access: { "web-app": { roles: [] } },
};
const AGENT_B = {
  sub: "agent-b",
  email: "b@example.com",
  name: "Agent B",
  realm_access: { roles: ["agent"] },
  resource_access: { "web-app": { roles: [] } },
};

const DB_A = { id: "DB_A", keycloakId: "agent-a" };
const DB_B = { id: "DB_B", keycloakId: "agent-b" };

const LEAD = { id: "lead-1", agentId: "DB_A", status: "NEW" };
const POLICY = {
  id: "p-1",
  name: "Family Health Secure",
  provider: "SureSecure",
  isActive: true,
  currentVersionId: "pv-1",
};
const VERSION = { id: "pv-1", versionNum: 1 };
const SNAPSHOT = {
  id: "snap-1",
  policyVersionId: "pv-1",
  requirements: [
    {
      id: "req-1",
      ruleKey: "kyc_pan",
      label: "Valid PAN",
      description: "A valid PAN card on file",
      confidence: 0.99,
      extractionMode: "ocr",
      validationRules: null,
      sourceChunkIds: [],
    },
  ],
};
const EVIDENCE = {
  id: "doc-1",
  docType: "PAN",
  status: "VALIDATED",
  requirementRuleKey: "kyc_pan",
  validationReport: { status: "PASS", deterministicPass: true },
};

function makeApp(status: string, documents: unknown[] = []) {
  return {
    id: "app-1",
    leadId: "lead-1",
    policyId: "p-1",
    policyVersionId: "pv-1",
    status,
    submittedAt: status === "DRAFT" ? null : new Date(),
    lead: { id: "lead-1", agentId: "DB_A" },
    policy: { ...POLICY },
    policyVersion: { id: "pv-1", versionNum: 1, snapshot: SNAPSHOT },
    documents,
  };
}

// Mutable application state so the full flow can advance through the DB layer.
const state: { app: Record<string, unknown> | null } = { app: null };

function req(url: string, opts: RequestInit = {}): NextRequest {
  return new NextRequest(url, opts as never);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) }) as any;

function asAgent(payload: unknown) {
  mockValidateAuth.mockResolvedValue({ valid: true, payload });
}

const PASSING_PAN: DocumentExtractionRecord = {
  docType: "PAN",
  fields: {
    panNumber: { value: "ABCPX1234F", confidence: 0.99, extractionMode: "INFERRED" },
    fullName: { value: "Ashok Kumar", confidence: 1, extractionMode: "INFERRED" },
  },
  extractedAt: "2026-01-01T00:00:00.000Z",
  model: "test",
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("issuance flow (application → validation → approval → issuance)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.app = null;
    mockEnsureUserInDb.mockImplementation(async ({ sub }: { sub: string }) =>
      sub === "agent-b" ? DB_B : DB_A
    );
    dbMock.user.findUnique.mockImplementation(async ({ where }: { where: { keycloakId: string } }) =>
      where.keycloakId === "agent-b" ? DB_B : DB_A
    );
    llmMock.mockRejectedValue(new Error("LLM outage"));
  });

  it("runs the complete flow: upload → application → validation → checklist → APPROVED → issuance", async () => {
    asAgent(AGENT_A);
    dbMock.policyLead.findFirst.mockResolvedValue(LEAD);
    dbMock.policy.findFirst.mockResolvedValue(POLICY);
    dbMock.policyVersion.findUnique.mockResolvedValue(VERSION);
    dbMock.requirementSnapshot.findUnique.mockResolvedValue(SNAPSHOT);
    dbMock.application.findFirst.mockImplementation(async () => state.app);
    dbMock.application.create.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      state.app = { ...makeApp("DRAFT"), ...args.data };
      return state.app;
    });
    dbMock.application.updateMany.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      state.app = { ...state.app!, ...args.data };
      return { count: 1 };
    });
    dbMock.application.update.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      state.app = { ...state.app!, ...args.data };
      return state.app;
    });
    dbMock.policyIssuance.create.mockResolvedValue({ id: 1, status: "ACTIVE" });
    dbMock.policyLead.update.mockResolvedValue(LEAD);
    dbMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        policyIssuance: dbMock.policyIssuance,
        policyLead: dbMock.policyLead,
        application: dbMock.application,
        $queryRaw: async () => [],
      })
    );

    // 1) Application (DRAFT) against an existing, active, published policy.
    const appRes = await createApplicationPOST(
      req("http://localhost:3000/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: "lead-1", policyName: "Family Health Secure" }),
      })
    );
    expect(appRes.status).toBe(201);
    const appJson = await appRes.json();
    expect(appJson.data.id).toBe("app-1");
    expect(appJson.data.status).toBe("DRAFT");

    // 1b) Re-creating the same (lead, policy, version) reuses the application.
    const appRes2 = await createApplicationPOST(
      req("http://localhost:3000/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: "lead-1", policyName: "Family Health Secure" }),
      })
    );
    expect(appRes2.status).toBe(201);
    expect((await appRes2.json()).data.id).toBe("app-1");

    // 2) Document upload (multipart) bound to the owned application.
    const form = new FormData();
    form.append("applicationId", "app-1");
    form.append("expectedDocType", "PAN");
    form.append("file", new File([PNG], "pan.png", { type: "image/png" }));
    dbMock.customerDocument.findUnique.mockResolvedValue(null);
    dbMock.customerDocument.create.mockResolvedValue({
      id: "doc-1",
      applicationId: "app-1",
      docType: "PAN",
      status: "UPLOADED",
      mimeType: "image/png",
      sizeBytes: PNG.length,
      createdAt: new Date(),
    });
    const upRes = await uploadDocumentPOST(
      req("http://localhost:3000/api/documents", { method: "POST", body: form } as RequestInit)
    );
    expect(upRes.status).toBe(201);
    const upJson = await upRes.json();
    expect(upJson.data.id).toBe("doc-1");
    expect(upJson.data.status).toBe("UPLOADED");
    expect(upJson.data.docType).toBe("PAN");

    // 3) Processing/validation: deterministic PASS is authoritative even when
    //    the LLM assist engine is down (LLM outage must never block issuance).
    const outcome = await validateDocument("doc-1", PASSING_PAN);
    expect(outcome.status).toBe("PASS");
    expect(outcome.deterministicPass).toBe(true);
    expect(outcome.aiAssist).toBeNull();
    expect(dbMock.documentValidationReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: "doc-1" },
        create: expect.objectContaining({ status: "PASS" }),
      })
    );

    // 4) Submit: DRAFT → SUBMITTED.
    state.app = makeApp("DRAFT");
    const subRes = await submitApplicationPOST(
      req("http://localhost:3000/api/applications/app-1/submit", { method: "POST" }),
      params("app-1")
    );
    expect(subRes.status).toBe(200);
    expect((await subRes.json()).data.application.status).toBe("SUBMITTED");
    expect(state.app!.status).toBe("SUBMITTED");

    // 5) Approve: the frozen-snapshot checklist gates approval deterministically.
    state.app = makeApp("SUBMITTED", [EVIDENCE]);
    const apprRes = await approveApplicationPOST(
      req("http://localhost:3000/api/applications/app-1/approve", { method: "POST" }),
      params("app-1")
    );
    expect(apprRes.status).toBe(200);
    const apprJson = await apprRes.json();
    expect(apprJson.data.application.status).toBe("APPROVED");
    expect(apprJson.data.evaluation.canApprove).toBe(true);
    expect(apprJson.data.evaluation.requirements[0]).toMatchObject({
      ruleKey: "kyc_pan",
      satisfied: true,
      evidenceDocType: "PAN",
    });

    // 6) Issue: policy name/provider come from the frozen catalog record, never
    //    from client input. Lead → POLICY_ISSUED, application → ISSUED.
    state.app = makeApp("APPROVED", [EVIDENCE]);
    const issRes = await issuancePOST(
      req("http://localhost:3000/api/issuances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId: "app-1", premiumAmount: 2400 }),
      })
    );
    expect(issRes.status).toBe(201);
    expect(dbMock.policyIssuance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: "lead-1",
          policyName: "Family Health Secure",
          policyProvider: "SureSecure",
          applicationId: "app-1",
          policyId: "p-1",
          policyVersionId: "pv-1",
          status: "ACTIVE",
          premiumAmount: 2400,
        }),
      })
    );
    expect(dbMock.policyLead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "POLICY_ISSUED" }) })
    );
    expect(dbMock.application.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ISSUED" }) })
    );
  });

  it("blocks issuance before approval (409 not approved)", async () => {
    asAgent(AGENT_A);
    dbMock.application.findFirst.mockResolvedValue(makeApp("SUBMITTED", [EVIDENCE]));
    dbMock.policyIssuance.findFirst.mockResolvedValue(null);

    const res = await issuancePOST(
      req("http://localhost:3000/api/issuances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId: "app-1" }),
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("not approved");
    expect(dbMock.policyIssuance.create).not.toHaveBeenCalled();
  });

  it("rejects cross-agent submit (IDOR, 403)", async () => {
    asAgent(AGENT_B);
    dbMock.application.findFirst.mockResolvedValue(makeApp("DRAFT"));

    const res = await submitApplicationPOST(
      req("http://localhost:3000/api/applications/app-1/submit", { method: "POST" }),
      params("app-1")
    );
    expect(res.status).toBe(403);
    expect(dbMock.application.updateMany).not.toHaveBeenCalled();
  });

  it("rejects cross-agent issuance (IDOR, 403)", async () => {
    asAgent(AGENT_B);
    dbMock.application.findFirst.mockResolvedValue(makeApp("APPROVED", [EVIDENCE]));

    const res = await issuancePOST(
      req("http://localhost:3000/api/issuances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId: "app-1" }),
      })
    );
    expect(res.status).toBe(403);
    expect(dbMock.policyIssuance.create).not.toHaveBeenCalled();
  });

  it("blocks issuance when the policy has been deactivated (409)", async () => {
    asAgent(AGENT_A);
    const app = makeApp("APPROVED", [EVIDENCE]);
    (app.policy as { isActive: boolean }).isActive = false;
    dbMock.application.findFirst.mockResolvedValue(app);

    const res = await issuancePOST(
      req("http://localhost:3000/api/issuances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId: "app-1" }),
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("no longer active");
  });

  it("blocks duplicate issuance for the same lead+policy (409)", async () => {
    asAgent(AGENT_A);
    dbMock.application.findFirst.mockResolvedValue(makeApp("APPROVED", [EVIDENCE]));
    dbMock.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "5.0.0" })
    );
    dbMock.policyIssuance.findFirst.mockResolvedValue({ id: 99 });

    const res = await issuancePOST(
      req("http://localhost:3000/api/issuances", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applicationId: "app-1" }),
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Policy already issued for this lead");
  });

  it("does not manufacture policy catalog records from client input (404)", async () => {
    asAgent(AGENT_A);
    dbMock.policyLead.findFirst.mockResolvedValue(LEAD);
    dbMock.policy.findFirst.mockResolvedValue(null);

    const res = await createApplicationPOST(
      req("http://localhost:3000/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId: "lead-1", policyName: "Totally Made Up Policy" }),
      })
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("Policy not found");
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });

  it("supports explicit suitability rejection (SUBMITTED → REJECTED)", async () => {
    asAgent(AGENT_A);
    dbMock.application.findFirst.mockResolvedValue(makeApp("SUBMITTED"));
    dbMock.application.updateMany.mockResolvedValue({ count: 1 });

    const res = await rejectApplicationPOST(
      req("http://localhost:3000/api/applications/app-1/reject", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Declined income band" }),
      }),
      params("app-1")
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.application.status).toBe("REJECTED");
    expect(dbMock.application.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) })
    );
  });
});

describe("LLM is not a gate (deterministic validation is authoritative)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.documentValidationReport.upsert.mockResolvedValue({});
  });

  it("deterministic PASS survives an LLM outage", async () => {
    llmMock.mockRejectedValue(new Error("LLM unreachable"));
    const outcome = await validateDocument("doc-1", PASSING_PAN);
    expect(outcome.status).toBe("PASS");
    expect(outcome.deterministicPass).toBe(true);
    expect(outcome.aiAssist).toBeNull();
  });

  it("deterministic PASS is not downgraded by an LLM 'reject' suggestion", async () => {
    llmMock.mockResolvedValue(JSON.stringify({ reasoning: "model prefers manual review", suggestion: "reject" }));
    const outcome = await validateDocument("doc-1", PASSING_PAN);
    expect(outcome.status).toBe("PASS");
    expect(outcome.deterministicPass).toBe(true);
  });

  it("deterministic FAIL is not overridden by an LLM 'approve' suggestion", async () => {
    llmMock.mockResolvedValue(JSON.stringify({ reasoning: "looks fine", suggestion: "approve" }));
    const badPan: DocumentExtractionRecord = {
      docType: "PAN",
      fields: {
        panNumber: { value: "XYZ12", confidence: 0.8, extractionMode: "INFERRED" },
        fullName: { value: "Ashok Kumar", confidence: 1, extractionMode: "INFERRED" },
      },
      extractedAt: "2026-01-01T00:00:00.000Z",
      model: "test",
    };
    const outcome = await validateDocument("doc-1", badPan);
    expect(outcome.status).toBe("FAIL");
    expect(outcome.deterministicPass).toBe(false);
    expect(llmMock).not.toHaveBeenCalled();
  });
});
