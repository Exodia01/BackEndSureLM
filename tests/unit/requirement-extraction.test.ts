import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

const dbMock = {
  brochure: {
    findUnique: vi.fn(),
  },
  policy: {
    findUnique: vi.fn(),
  },
  chunk: {
    findMany: vi.fn(),
  },
  requirementDefinition: {
    deleteMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

const llmMock = vi.fn();
vi.mock("@/lib/ai/agents/llm", () => ({
  generateLLMResponse: (...args: unknown[]) => llmMock(...args),
}));

const { extractRequirements, approveRequirement, MAX_ATTEMPTS } = await import(
  "@/lib/ai/extractRequirements"
);

const VALID_RESPONSE = JSON.stringify({
  productType: "TERM_INSURANCE",
  requirements: [
    {
      ruleKey: "min_entry_age",
      label: "Minimum Entry Age",
      description: "Entry age is 18 years.",
      documentType: "BROCHURE",
      category: "eligibility",
      isMandatory: true,
      displayOrder: 0,
      onMaxAttemptsMessage: "Entry age must be verified. Please contact support.",
      confidence: 0.95,
      extractionMode: "EXPLICIT",
      validationRules: { minEntryAge: 18 },
    },
    {
      ruleKey: "max_entry_age",
      label: "Maximum Entry Age",
      description: "Entry age capped at 65 years at maturity.",
      documentType: "BROCHURE",
      category: "eligibility",
      isMandatory: false,
      displayOrder: 1,
      onMaxAttemptsMessage: "Age limit could not be confirmed.",
      confidence: 0.8,
      extractionMode: "INFERRED",
      validationRules: { maxEntryAge: 65 },
    },
  ],
});

describe("requirement extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a policyId", async () => {
    await expect(extractRequirements("b1", "")).rejects.toThrow("policyId is required");
    await expect(extractRequirements("b1", undefined as unknown as string)).rejects.toThrow(
      "policyId is required"
    );
  });

  it("requires a READY brochure with chunks", async () => {
    dbMock.brochure.findUnique.mockResolvedValue({ status: "PROCESSING" });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    await expect(extractRequirements("b1", "p1")).rejects.toThrow(
      "Brochure must be READY"
    );

    dbMock.brochure.findUnique.mockResolvedValue({ status: "READY" });
    dbMock.chunk.findMany.mockResolvedValue([]);
    await expect(extractRequirements("b1", "p1")).rejects.toThrow("no chunks");
  });

  it("parses valid JSON and creates draft requirements with provenance", async () => {
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "READY" });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    dbMock.chunk.findMany.mockResolvedValue([
      { id: "c1", chunkOrder: 0, content: "Entry age 18 years" },
    ]);
    llmMock.mockResolvedValue(VALID_RESPONSE);
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));

    const result = await extractRequirements("b1", "p1");

    expect(result.draftsCreated).toBe(2);
    expect(llmMock).toHaveBeenCalledTimes(1);

    const createCalls = dbMock.requirementDefinition.create.mock.calls;
    expect(createCalls).toHaveLength(2);
    const expectedFrozen = [
      {
        documentType: "BROCHURE",
        category: "eligibility",
        isMandatory: true,
        displayOrder: 0,
        onMaxAttemptsMessage: "Entry age must be verified. Please contact support.",
      },
      {
        documentType: "BROCHURE",
        category: "eligibility",
        isMandatory: false,
        displayOrder: 1,
        onMaxAttemptsMessage: "Age limit could not be confirmed.",
      },
    ];
    for (let i = 0; i < createCalls.length; i++) {
      const [arg] = createCalls[i];
      expect(arg.data.isDraft).toBe(true);
      expect(arg.data.policyId).toBe("p1");
      expect(arg.data.brochureId).toBe("b1");
      expect(arg.data.maxAttempts).toBe(MAX_ATTEMPTS);
      expect(arg.data.sourceChunkIds).toEqual(["c1"]);
      expect(arg.data.provenance).toMatchObject({
        source_brochure_id: "b1",
        source_chunk_ids: ["c1"],
        extraction_model: expect.any(String),
        extracted_at: expect.any(String),
      });
      // Frozen-contract fields are persisted verbatim, never discarded.
      expect(arg.data.documentType).toBe(expectedFrozen[i].documentType);
      expect(arg.data.category).toBe(expectedFrozen[i].category);
      expect(arg.data.isMandatory).toBe(expectedFrozen[i].isMandatory);
      expect(arg.data.displayOrder).toBe(expectedFrozen[i].displayOrder);
      expect(arg.data.onMaxAttemptsMessage).toBe(expectedFrozen[i].onMaxAttemptsMessage);
    }
  });

  it("replaces previous drafts and never touches approved definitions", async () => {
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "READY" });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    dbMock.chunk.findMany.mockResolvedValue([{ id: "c1", chunkOrder: 0, content: "x" }]);
    llmMock.mockResolvedValue(VALID_RESPONSE);
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));

    await extractRequirements("b1", "p1");

    expect(dbMock.requirementDefinition.deleteMany).toHaveBeenCalledWith({
      where: { policyId: "p1", brochureId: "b1", isDraft: true },
    });
  });

  it("retries up to MAX_ATTEMPTS on invalid output then fails", async () => {
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "READY" });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    dbMock.chunk.findMany.mockResolvedValue([{ id: "c1", chunkOrder: 0, content: "x" }]);
    llmMock.mockResolvedValue("not json at all");
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));

    await expect(extractRequirements("b1", "p1")).rejects.toThrow(
      new RegExp(`after ${MAX_ATTEMPTS} attempts`)
    );
    expect(llmMock).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(dbMock.requirementDefinition.create).not.toHaveBeenCalled();
  });

  it("accepts JSON wrapped in markdown code fences", async () => {
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "READY" });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    dbMock.chunk.findMany.mockResolvedValue([{ id: "c1", chunkOrder: 0, content: "x" }]);
    llmMock.mockResolvedValue(`\`\`\`json\n${VALID_RESPONSE}\n\`\`\``);
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));

    const result = await extractRequirements("b1", "p1");
    expect(result.draftsCreated).toBe(2);
  });

  it("rejects invalid extractionMode values", async () => {
    const bad = JSON.stringify({
      requirements: [
        {
          ruleKey: "r1",
          label: "R1",
          description: "desc",
          category: "eligibility",
          confidence: 0.5,
          extractionMode: "GUESSED",
        },
      ],
    });
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "READY" });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    dbMock.chunk.findMany.mockResolvedValue([{ id: "c1", chunkOrder: 0, content: "x" }]);
    llmMock.mockResolvedValue(bad);
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));

    await expect(extractRequirements("b1", "p1")).rejects.toThrow();
  });

  it("persists null for omitted frozen fields while keeping required invariants", async () => {
    const minimal = JSON.stringify({
      productType: "TERM_INSURANCE",
      requirements: [
        {
          ruleKey: "kyc_documents",
          label: "KYC Documents",
          description: "Identity documents required at application.",
          category: "policy_features",
          confidence: 0.9,
          extractionMode: "EXPLICIT",
        },
      ],
    });
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "READY" });
    dbMock.policy.findUnique.mockResolvedValue({ id: "p1" });
    dbMock.chunk.findMany.mockResolvedValue([{ id: "c1", chunkOrder: 0, content: "x" }]);
    llmMock.mockResolvedValue(minimal);
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));

    const result = await extractRequirements("b1", "p1");

    expect(result.draftsCreated).toBe(1);
    const [arg] = dbMock.requirementDefinition.create.mock.calls[0];
    expect(arg.data.isDraft).toBe(true);
    expect(arg.data.maxAttempts).toBe(MAX_ATTEMPTS);
    expect(arg.data.isMandatory).toBeNull();
    expect(arg.data.displayOrder).toBeNull();
    expect(arg.data.onMaxAttemptsMessage).toBeNull();
    expect(arg.data.documentType).toBeNull();
    // category is required by the schema and still persisted when present.
    expect(arg.data.category).toBe("policy_features");
  });

  it("approveRequirement rejects when an approved ruleKey already exists", async () => {
    dbMock.requirementDefinition.findUnique.mockResolvedValue({
      id: "req1",
      policyId: "p1",
      ruleKey: "min_entry_age",
      isDraft: true,
    });
    dbMock.requirementDefinition.findFirst.mockResolvedValue({ id: "req2" });

    await expect(approveRequirement("req1", "admin-1")).rejects.toThrow(
      'already has an approved requirement for ruleKey "min_entry_age"'
    );
  });

  it("approveRequirement approves a draft when no conflict exists", async () => {
    dbMock.requirementDefinition.findUnique.mockResolvedValue({
      id: "req1",
      policyId: "p1",
      ruleKey: "min_entry_age",
      isDraft: true,
    });
    dbMock.requirementDefinition.findFirst.mockResolvedValue(null);
    dbMock.requirementDefinition.update.mockResolvedValue({});

    await approveRequirement("req1", "admin-1");

    expect(dbMock.requirementDefinition.update).toHaveBeenCalledWith({
      where: { id: "req1" },
      data: expect.objectContaining({ isDraft: false, approvedBy: "admin-1" }),
    });
  });

  it("zod schema validation: negative age is rejected", () => {
    const schema = z
      .object({ minEntryAge: z.number().min(0) })
      .strict();
    expect(() => schema.parse({ minEntryAge: -5 })).toThrow();
    expect(() => schema.parse({ minEntryAge: 18 })).not.toThrow();
  });
});
