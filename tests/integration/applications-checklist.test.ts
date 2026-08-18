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
  application: { findFirst: vi.fn() },
  policyVersion: { findUnique: vi.fn() },
  auditEvent: { create: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { GET: getChecklist } = await import("@/app/api/applications/[id]/checklist/route");
const { getApplicationChecklist, getChecklistEvaluation } = await import("@/lib/applications/lifecycle");
const { evaluateChecklist, classifyRequirement } = await import("@/lib/applications/checklist");

const AGENT_A = {
  sub: "agent-a",
  email: "a@example.com",
  name: "Agent A",
  realm_access: { roles: ["agent"] },
  resource_access: { "web-app": { roles: [] } },
};

const SNAPSHOT_V1 = {
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

function makeApp(status: string, documents: unknown[] = [], snapshot = SNAPSHOT_V1) {
  return {
    id: "app-1",
    leadId: "lead-1",
    policyId: "p-1",
    policyVersionId: "pv-1",
    status,
    submittedAt: status === "DRAFT" ? null : new Date(),
    lead: { id: "lead-1", agentId: "DB_A" },
    policy: { name: "Family Health Secure", provider: "SureSecure", isActive: true },
    policyVersion: { id: "pv-1", versionNum: 1, snapshot },
    documents,
  };
}

function req(url: string): NextRequest {
  return new NextRequest(url, { method: "GET" } as never);
}

const params = (id: string) => ({ params: Promise.resolve({ id }) }) as any;

describe("GET /api/applications/:id/checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureUserInDb.mockResolvedValue({ id: "DB_A", keycloakId: "agent-a" });
    dbMock.policyVersion.findUnique.mockImplementation(() => {
      throw new Error("checklist must never query the current PolicyVersion");
    });
  });

  it("returns the frozen-snapshot checklist for the owning agent (no PII)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.application.findFirst.mockResolvedValue(
      makeApp("SUBMITTED", [
        {
          id: "doc-1",
          docType: "PAN",
          status: "VALIDATED",
          requirementRuleKey: "kyc_pan",
          validationReport: { status: "PASS", deterministicPass: true },
        },
      ])
    );

    const res = await getChecklist(req("http://localhost:3000/api/applications/app-1/checklist"), params("app-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const { application, evaluation, documents } = json.data;
    expect(application).toEqual({ id: "app-1", status: "SUBMITTED" });
    expect(evaluation.canApprove).toBe(true);
    expect(evaluation.satisfied).toBe(true);
    expect(evaluation.hasReviewRequired).toBe(false);
    expect(evaluation.hasFailedDocuments).toBe(false);
    expect(evaluation.requirements).toHaveLength(1);
    expect(evaluation.requirements[0]).toMatchObject({
      ruleKey: "kyc_pan",
      label: "Valid PAN",
      evidenceDocType: "PAN",
      satisfied: true,
      evidenceDocumentId: "doc-1",
    });

    // Documents carry review state only — never PII or raw payloads.
    expect(documents).toEqual([
      { id: "doc-1", docType: "PAN", status: "VALIDATED", requirementRuleKey: "kyc_pan" },
    ]);
    const raw = JSON.stringify(json);
    expect(raw).not.toContain("ocrData");
    expect(raw).not.toContain("extractedData");
    expect(raw).not.toContain("originalFilename");

    // The checklist read is audited.
    expect(dbMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "application.checklist_viewed", entityId: "app-1" }),
      })
    );
    // The current/latest policy version was never consulted.
    expect(dbMock.policyVersion.findUnique).not.toHaveBeenCalled();
  });

  it("reports unsatisfied requirements with reasons and blocks approval", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.application.findFirst.mockResolvedValue(
      makeApp("SUBMITTED", [
        {
          id: "doc-1",
          docType: "PAN",
          status: "REVIEW_REQUIRED",
          requirementRuleKey: "kyc_pan",
          validationReport: { status: "REVIEW_REQUIRED", deterministicPass: null },
        },
      ])
    );

    const res = await getChecklist(req("http://localhost:3000/api/applications/app-1/checklist"), params("app-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.evaluation.canApprove).toBe(false);
    expect(json.data.evaluation.hasReviewRequired).toBe(true);
    expect(json.data.evaluation.requirements[0].satisfied).toBe(false);
    expect(json.data.evaluation.requirements[0].reason).toContain("Missing validated PAN evidence");
    expect(json.data.evaluation.blockers.length).toBeGreaterThan(0);
  });

  it("returns 403 for a cross-agent application (IDOR)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.application.findFirst.mockResolvedValue(
      makeApp("SUBMITTED", [], {
        ...SNAPSHOT_V1,
        // Owned by a different agent — loadOwnedApplication must reject.
      })
    );
    // Simulate ownership mismatch: lead belongs to another agent.
    dbMock.application.findFirst.mockResolvedValue({
      ...makeApp("SUBMITTED"),
      lead: { id: "lead-1", agentId: "OTHER_AGENT" },
    });

    const res = await getChecklist(req("http://localhost:3000/api/applications/app-1/checklist"), params("app-1"));
    expect(res.status).toBe(403);
    expect(dbMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the application does not exist", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_A });
    dbMock.application.findFirst.mockResolvedValue(null);

    const res = await getChecklist(req("http://localhost:3000/api/applications/app-1/checklist"), params("app-1"));
    expect(res.status).toBe(404);
  });

  it("returns 429 once the checklist read limit is exceeded", async () => {
    const sub = `cl-rate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    mockValidateAuth.mockResolvedValue({ valid: true, payload: { ...AGENT_A, sub } });
    dbMock.application.findFirst.mockResolvedValue(makeApp("SUBMITTED"));

    const limit = RATE_LIMITS["applications:checklist"].limit;
    for (let i = 0; i < limit; i++) {
      const res = await getChecklist(req("http://localhost:3000/api/applications/app-1/checklist"), params("app-1"));
      expect(res.status).toBe(200);
    }

    const res = await getChecklist(req("http://localhost:3000/api/applications/app-1/checklist"), params("app-1"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = await res.json();
    expect(body.error).toBe("Rate limit exceeded");
    expect(body.action).toBe("applications:checklist");
  });
});

describe("getApplicationChecklist — frozen snapshot is authoritative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the application's embedded snapshot, never the current/latest version", async () => {
    dbMock.policyVersion.findUnique.mockImplementation(() => {
      throw new Error("must not query PolicyVersion");
    });
    dbMock.application.findFirst.mockResolvedValue(
      makeApp("SUBMITTED", [
        {
          id: "doc-1",
          docType: "PAN",
          status: "VALIDATED",
          requirementRuleKey: "kyc_pan",
          validationReport: { status: "PASS", deterministicPass: true },
        },
      ])
    );

    const view = await getApplicationChecklist("DB_A", "app-1");
    expect(view.application.status).toBe("SUBMITTED");
    expect(view.evaluation.requirements).toHaveLength(1);
    expect(view.evaluation.requirements[0].ruleKey).toBe("kyc_pan");
    expect(view.evaluation.canApprove).toBe(true);
    expect(dbMock.policyVersion.findUnique).not.toHaveBeenCalled();
  });

  it("getChecklistEvaluation is a pure function of the loaded application", async () => {
    const app = makeApp("APPROVED", [
      {
        id: "doc-1",
        docType: "PAN",
        status: "VALIDATED",
        requirementRuleKey: "kyc_pan",
        validationReport: { status: "PASS", deterministicPass: true },
      },
    ]) as never;
    const evaluation = getChecklistEvaluation(app);
    expect(evaluation.satisfied).toBe(true);
    expect(evaluation.canApprove).toBe(true);
  });
});

describe("evaluateChecklist — taxonomy-aware classification", () => {
  it("an artifact ruleKey (max_attempts_*) stays UNSATISFIED (fail closed) even with valid documents", () => {
    const evaluation = evaluateChecklist(
      [
        {
          id: "req-x",
          ruleKey: "max_attempts_message",
          label: "Maximum Attempts Message",
          description: null,
          confidence: 0.9,
          extractionMode: "ocr",
          validationRules: null,
          sourceChunkIds: [],
        },
      ],
      [
        {
          id: "doc-1",
          docType: "PAN",
          status: "VALIDATED",
          requirementRuleKey: null,
          validationStatus: "PASS",
          deterministicPass: true,
        },
      ]
    );

    expect(evaluation.requirements[0].classification).toBe("UNCLASSIFIED");
    expect(evaluation.requirements[0].evidenceDocType).toBeNull();
    expect(evaluation.requirements[0].satisfied).toBe(false);
    expect(evaluation.requirements[0].reason).toContain("Unclassified requirement");
    expect(evaluation.canApprove).toBe(false);
    expect(evaluation.satisfied).toBe(false);
  });

  it("a non-artifact unknown ruleKey is classified as POLICY_KNOWLEDGE (satisfied from context)", () => {
    const evaluation = evaluateChecklist(
      [
        {
          id: "req-x",
          ruleKey: "vehicle_age",
          label: "Vehicle within age limit",
          description: null,
          confidence: 0.9,
          extractionMode: "ocr",
          validationRules: null,
          sourceChunkIds: [],
        },
      ],
      []
    );

    expect(evaluation.requirements[0].classification).toBe("POLICY_KNOWLEDGE");
    expect(evaluation.requirements[0].evidenceDocType).toBeNull();
    expect(evaluation.requirements[0].satisfied).toBe(true);
    expect(evaluation.requirements[0].reason).toContain("Product knowledge requirement");
    expect(evaluation.satisfied).toBe(true);
    // canApprove requires requirements.length > 0, so it should be true
    expect(evaluation.canApprove).toBe(true);
  });

  it("a CUSTOMER_EVIDENCE ruleKey without evidence fails closed", () => {
    const evaluation = evaluateChecklist(
      [
        {
          id: "req-x",
          ruleKey: "kyc_documents",
          label: "KYC Documents",
          description: null,
          confidence: 0.9,
          extractionMode: "ocr",
          validationRules: null,
          sourceChunkIds: [],
        },
      ],
      []
    );

    expect(evaluation.requirements[0].classification).toBe("CUSTOMER_EVIDENCE");
    expect(evaluation.requirements[0].satisfied).toBe(false);
    expect(evaluation.requirements[0].reason).toContain("Missing validated");
    expect(evaluation.canApprove).toBe(false);
    // "No documents uploaded" should NOT appear because no documents exist
    // but the requirement IS evidence-gated
    expect(evaluation.blockers.some((b) => b.includes("No documents uploaded"))).toBe(true);
  });

  it("a POLICY_KNOWLEDGE-only checklist requires no documents to approve", () => {
    const evaluation = evaluateChecklist(
      [
        {
          id: "req-1",
          ruleKey: "min_entry_age",
          label: "Minimum Entry Age",
          description: null,
          confidence: 0.99,
          extractionMode: "ocr",
          validationRules: null,
          sourceChunkIds: [],
        },
        {
          id: "req-2",
          ruleKey: "max_entry_age",
          label: "Maximum Entry Age",
          description: null,
          confidence: 0.99,
          extractionMode: "ocr",
          validationRules: null,
          sourceChunkIds: [],
        },
      ],
      []
    );

    expect(evaluation.satisfied).toBe(true);
    expect(evaluation.canApprove).toBe(true);
    // No "No documents uploaded" blocker because no evidence-gated requirements
    expect(evaluation.blockers).not.toContainEqual(
      expect.stringContaining("No documents uploaded")
    );
  });
});

describe("classifyRequirement — Phase 2L genuine attempt allowlist", () => {
  it("max_attempts_change_option → POLICY_KNOWLEDGE (SmartLife brochure-backed)", () => {
    expect(classifyRequirement("max_attempts_change_option")).toBe("POLICY_KNOWLEDGE");
  });

  it("max_attempts_return_policy → POLICY_KNOWLEDGE (SmartLife free-look period)", () => {
    expect(classifyRequirement("max_attempts_return_policy")).toBe("POLICY_KNOWLEDGE");
  });

  it("max_attempts_message → UNCLASSIFIED (extraction noise, Single Invest Plus)", () => {
    expect(classifyRequirement("max_attempts_message")).toBe("UNCLASSIFIED");
  });

  it("other max_attempts_* keys remain UNCLASSIFIED (artifact rule not weakened)", () => {
    expect(classifyRequirement("max_attempts_foo")).toBe("UNCLASSIFIED");
    expect(classifyRequirement("max_attempts_something_else")).toBe("UNCLASSIFIED");
  });

  it("CUSTOMER_EVIDENCE keys remain unchanged", () => {
    expect(classifyRequirement("kyc_documents")).toBe("CUSTOMER_EVIDENCE");
    expect(classifyRequirement("kyc_pan")).toBe("CUSTOMER_EVIDENCE");
    expect(classifyRequirement("income_proof")).toBe("CUSTOMER_EVIDENCE");
  });

  it("ordinary policy knowledge keys remain POLICY_KNOWLEDGE", () => {
    expect(classifyRequirement("min_entry_age")).toBe("POLICY_KNOWLEDGE");
    expect(classifyRequirement("death_benefit")).toBe("POLICY_KNOWLEDGE");
    expect(classifyRequirement("premium_payment")).toBe("POLICY_KNOWLEDGE");
  });

  it("empty ruleKey returns UNCLASSIFIED", () => {
    expect(classifyRequirement("")).toBe("UNCLASSIFIED");
  });
});
