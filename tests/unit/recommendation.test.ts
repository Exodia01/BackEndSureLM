import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  requirementDefinition: {
    findMany: vi.fn(),
  },
};

const retrievePoliciesMock = vi.fn();
const resolveRecommendableIdsMock = vi.fn();
const embedMock = vi.fn();
const llmMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/ai/agents/retriever", () => ({
  retrievePoliciesWithContext: (...args: unknown[]) => retrievePoliciesMock(...args),
  resolveRecommendablePolicyIds: (...args: unknown[]) => resolveRecommendableIdsMock(...args),
}));

vi.mock("@/lib/ai/embeddings", () => ({
  generateOllamaEmbedding: (...args: unknown[]) => embedMock(...args),
}));

vi.mock("@/lib/ai/agents/llm", () => ({
  generateLLMResponse: (...args: unknown[]) => llmMock(...args),
}));

const {
  generateRecommendations,
} = await import("@/lib/ai/generateRecommendations");

const POLICY_RESULT = {
  id: "chunk-1",
  content: "Minimum entry age is 18 years, maximum 65.",
  score: 0.9,
  source: "qdrant",
  policyId: "p1",
  policyName: "Kotak Premier Life",
  provider: "Kotak",
  metadata: {
    chunk_id: "chunk-1",
    brochure_id: "b1",
    brochure_name: "kotak_premier_life",
    page_num: 3,
    policy_id: "p1",
    policy_name: "Kotak Premier Life",
    policy_version_num: 1,
  },
};

describe("recommendation engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns insufficientPolicyInformation when no policies are recommendable", async () => {
    resolveRecommendableIdsMock.mockResolvedValue([]);
    const result = await generateRecommendations("retirement plan", { age: 30 });
    expect(result.insufficientPolicyInformation).toBe(true);
    expect(result.recommendations).toEqual([]);
  });

  it("returns insufficientPolicyInformation when embedding fails", async () => {
    embedMock.mockRejectedValue(new Error("ollama down"));
    const result = await generateRecommendations("any query", { age: 30 });
    expect(result.insufficientPolicyInformation).toBe(true);
    expect(result.recommendations).toEqual([]);
  });

  it("returns insufficientPolicyInformation when retrieval finds nothing", async () => {
    resolveRecommendableIdsMock.mockResolvedValue(["p1"]);
    embedMock.mockResolvedValue([0.1, 0.2]);
    retrievePoliciesMock.mockResolvedValue([]);
    const result = await generateRecommendations("anything", { age: 30 });
    expect(result.insufficientPolicyInformation).toBe(true);
    expect(result.recommendations).toEqual([]);
  });

  it("flags insufficientCustomerInformation when no profile fields are given", async () => {
    resolveRecommendableIdsMock.mockResolvedValue(["p1"]);
    embedMock.mockResolvedValue([0.1, 0.2]);
    retrievePoliciesMock.mockResolvedValue([]);
    const result = await generateRecommendations("best plan", {});
    expect(result.insufficientCustomerInformation).toBe(true);
  });

  it("does NOT flag insufficientCustomerInformation when age+income are given", async () => {
    resolveRecommendableIdsMock.mockResolvedValue(["p1"]);
    embedMock.mockResolvedValue([0.1, 0.2]);
    retrievePoliciesMock.mockResolvedValue([]);
    const result = await generateRecommendations("plan", { age: 30, income: 50000 });
    expect(result.insufficientCustomerInformation).toBe(false);
  });

  it("builds an evidence-grounded recommendation with citations from retrieval", async () => {
    resolveRecommendableIdsMock.mockResolvedValue(["p1"]);
    embedMock.mockResolvedValue([0.1, 0.2]);
    retrievePoliciesMock.mockResolvedValue([POLICY_RESULT]);
    dbMock.requirementDefinition.findMany.mockResolvedValue([
      {
        policyId: "p1",
        ruleKey: "min_entry_age",
        label: "Minimum Entry Age",
        description: "18 years",
      },
    ]);
    llmMock.mockResolvedValue(
      JSON.stringify({
        recommendations: [
          {
            policyId: "p1",
            policyName: "Kotak Premier Life",
            reasoning: "Suitable due to low entry age threshold matching customer age.",
            features: ["Entry age 18-65"],
            concerns: [],
            suitabilityScore: 0.8,
          },
        ],
      })
    );

    const result = await generateRecommendations("term plan", { age: 30, income: 50000 });

    expect(result.insufficientPolicyInformation).toBe(false);
    expect(result.recommendations).toHaveLength(1);
    const rec = result.recommendations[0];
    expect(rec.policyId).toBe("p1");
    expect(rec.suitabilityLabel).toBe("model_derived");
    expect(rec.reasoning).toContain("entry age");
    expect(rec.requirements).toContainEqual(
      expect.objectContaining({ ruleKey: "min_entry_age", label: "Minimum Entry Age" })
    );
    expect(rec.citations).toContainEqual(
      expect.objectContaining({
        chunkId: "chunk-1",
        brochureId: "b1",
        policyId: "p1",
        policyVersionNum: 1,
      })
    );
    // The LLM prompt must have included the retrieved evidence, never invented policies.
    expect(llmMock).toHaveBeenCalled();
  });

  it("falls back to evidence-based ranking on malformed LLM JSON", async () => {
    resolveRecommendableIdsMock.mockResolvedValue(["p1"]);
    embedMock.mockResolvedValue([0.1, 0.2]);
    retrievePoliciesMock.mockResolvedValue([POLICY_RESULT]);
    dbMock.requirementDefinition.findMany.mockResolvedValue([]);
    llmMock.mockResolvedValue("not json at all {{{");

    const result = await generateRecommendations("term plan", { age: 30 });

    expect(result.insufficientPolicyInformation).toBe(false);
    expect(result.recommendations).toHaveLength(1);
    const rec = result.recommendations[0];
    expect(rec.suitabilityLabel).toBe("evidence_based");
    expect(rec.suitabilityScore).toBe(0);
    // No manufactured reasoning.
    expect(rec.reasoning).toContain("LLM ranking was unavailable");
    // Citations preserved through fallback.
    expect(rec.citations).toHaveLength(1);
  });

  it("falls back to evidence-based ranking on LLM throw", async () => {
    resolveRecommendableIdsMock.mockResolvedValue(["p1"]);
    embedMock.mockResolvedValue([0.1, 0.2]);
    retrievePoliciesMock.mockResolvedValue([POLICY_RESULT]);
    dbMock.requirementDefinition.findMany.mockResolvedValue([]);
    llmMock.mockRejectedValue(new Error("ollama error"));

    const result = await generateRecommendations("term plan", { age: 30 });

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].suitabilityLabel).toBe("evidence_based");
  });

  it("never emits a policy the retrieval did not surface", async () => {
    // LLM returns a policyId absent from the evidence → that recommendation is
    // dropped and the engine falls back to evidence-based ranking for the
    // policies that WERE retrieved.
    resolveRecommendableIdsMock.mockResolvedValue(["p1"]);
    embedMock.mockResolvedValue([0.1, 0.2]);
    retrievePoliciesMock.mockResolvedValue([POLICY_RESULT]);
    dbMock.requirementDefinition.findMany.mockResolvedValue([]);
    llmMock.mockResolvedValue(
      JSON.stringify({
        recommendations: [
          {
            policyId: "FAKE-POLICY",
            policyName: "Made Up Plan",
            reasoning: "Invented",
            features: [],
            concerns: [],
            suitabilityScore: 0.99,
          },
        ],
      })
    );

    const result = await generateRecommendations("term plan", { age: 30 });
    // The fabricated policy is never surfaced.
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].policyId).toBe("p1");
    expect(result.recommendations[0].policyName).toBe("Kotak Premier Life");
    // Evidence-based fallback with the real retrieved policy, citations intact.
    expect(result.recommendations[0].suitabilityLabel).toBe("evidence_based");
    expect(result.recommendations[0].citations).toHaveLength(1);
  });

  it("limits per-policy chunks to avoid prompt bloat", async () => {
    const manyChunks = Array.from({ length: 20 }, (_, i) => ({
      ...POLICY_RESULT,
      id: `chunk-${i}`,
      content: `chunk content ${i}`,
      metadata: { ...POLICY_RESULT.metadata, chunk_id: `chunk-${i}` },
    }));
    resolveRecommendableIdsMock.mockResolvedValue(["p1"]);
    embedMock.mockResolvedValue([0.1, 0.2]);
    retrievePoliciesMock.mockResolvedValue(manyChunks);
    dbMock.requirementDefinition.findMany.mockResolvedValue([]);
    llmMock.mockResolvedValue(
      JSON.stringify({
        recommendations: [
          {
            policyId: "p1",
            policyName: "Kotak Premier Life",
            reasoning: "ok",
            features: [],
            concerns: [],
            suitabilityScore: 0.5,
          },
        ],
      })
    );

    await generateRecommendations("q", { age: 30 });
    const prompt = llmMock.mock.calls[0][0][0].content as string;
    // 6 chunks max per policy in the prompt.
    expect((prompt.match(/\[CHUNK\]/g) || []).length).toBeLessThanOrEqual(6);
  });
});
