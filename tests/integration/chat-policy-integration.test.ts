import { describe, it, expect, vi, beforeEach } from "vitest";

const retrievePoliciesMock = vi.fn();
const resolveRecommendableIdsMock = vi.fn();
const hybridRetrieveMock = vi.fn();
const embedMock = vi.fn();
const llmMock = vi.fn();
const rerankMock = vi.fn();

vi.mock("@/lib/ai/agents/retriever", () => ({
  hybridRetrieve: (...args: unknown[]) => hybridRetrieveMock(...args),
  retrievePoliciesWithContext: (...args: unknown[]) => retrievePoliciesMock(...args),
  resolveRecommendablePolicyIds: (...args: unknown[]) => resolveRecommendableIdsMock(...args),
}));

vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: (...args: unknown[]) => embedMock(...args),
}));

vi.mock("@/lib/ai/agents/llm", () => ({
  generateLLMResponse: (...args: unknown[]) => llmMock(...args),
  streamLLMResponse: vi.fn(),
}));

vi.mock("@/lib/ai/agents/reranker", () => ({
  rerank: (...args: unknown[]) => rerankMock(...args),
}));

vi.mock("@/lib/ai/generateRecommendations", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/generateRecommendations")>();
  return {
    ...original,
    generateRecommendations: vi.fn(),
  };
});

vi.mock("@/lib/ai/intent", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ai/intent")>();
  return {
    ...original,
  };
});

const { orchestrateQuery } = await import("@/lib/ai/orchestrator");
const { detectRecommendationIntent, isPolicyQuestion } = await import("@/lib/ai/intent");

describe("chat policy integration (orchestrator)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    embedMock.mockResolvedValue([0.1, 0.2, 0.3]);
    rerankMock.mockImplementation(async (_query: string, candidates: unknown[]) => ({
      results: candidates as any[],
      method: "rrfs",
    }));
  });

  it("isPolicyQuestion detects policy-domain vocabulary", () => {
    expect(isPolicyQuestion("what is the entry age for the term plan")).toBe(true);
    expect(isPolicyQuestion("how are you today")).toBe(false);
  });

  it("detectRecommendationIntent requires BOTH domain and framing words", () => {
    // "best" alone never triggers.
    expect(detectRecommendationIntent("which is best")).toBe(false);
    expect(detectRecommendationIntent("suggest something good")).toBe(false);
    // Domain + framing → true.
    expect(detectRecommendationIntent("which term policy do you recommend")).toBe(true);
    expect(detectRecommendationIntent("compare term plans for me")).toBe(true);
  });

  it("runs policy-aware approved retrieval for policy questions", async () => {
    retrievePoliciesMock.mockResolvedValue([
      {
        id: "chunk-1",
        content: "Entry age 18 to 65.",
        score: 0.9,
        source: "qdrant",
        policyId: "p1",
        policyName: "Kotak Premier Life",
        metadata: { chunk_id: "chunk-1", policy_name: "Kotak Premier Life" },
      },
    ]);
    hybridRetrieveMock.mockResolvedValue([]);
    llmMock.mockResolvedValue("Entry age is 18 to 65 years [Source 1].");

    const res = await orchestrateQuery({
      messages: [{ role: "user", content: "what is the entry age for this term policy?" }],
    });

    expect(retrievePoliciesMock).toHaveBeenCalledWith(
      "what is the entry age for this term policy?",
      [0.1, 0.2, 0.3],
      expect.objectContaining({ onlyApproved: true })
    );
    expect(llmMock).toHaveBeenCalled();
    // The system prompt must contain the grounded evidence.
    const prompt = llmMock.mock.calls[0][0][0].content as string;
    expect(prompt).toContain("Entry age 18 to 65.");
    expect(prompt).toContain("[Source 1]");
  });

  it("invokes the recommendation engine when intent is detected", async () => {
    const { generateRecommendations } = await import("@/lib/ai/generateRecommendations");
    (generateRecommendations as ReturnType<typeof vi.fn>).mockResolvedValue({
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
          citations: [{ chunkId: "c1", policyId: "p1" }],
        },
      ],
      insufficientPolicyInformation: false,
      insufficientCustomerInformation: true,
    });
    llmMock.mockResolvedValue("I recommend Kotak Premier Life [Source 1].");

    await orchestrateQuery({
      messages: [{ role: "user", content: "which term policy do you recommend for a 30 year old?" }],
    });

    expect(generateRecommendations).toHaveBeenCalled();
    const prompt = llmMock.mock.calls[0][0][0].content as string;
    expect(prompt).toContain("RECOMMENDATION EVIDENCE");
    expect(prompt).toContain("suitability is a model-derived ranking");
  });

  it("does NOT invoke the recommendation engine for a non-recommendation question", async () => {
    const { generateRecommendations } = await import("@/lib/ai/generateRecommendations");
    retrievePoliciesMock.mockResolvedValue([]);
    hybridRetrieveMock.mockResolvedValue([]);
    llmMock.mockResolvedValue("I don't have that information.");

    await orchestrateQuery({
      messages: [{ role: "user", content: "what is the weather today?" }],
    });

    expect(generateRecommendations).not.toHaveBeenCalled();
    expect(retrievePoliciesMock).not.toHaveBeenCalled(); // not a policy question
    expect(hybridRetrieveMock).toHaveBeenCalled();
  });

  it("discloses insufficient evidence honestly (no fabrication)", async () => {
    retrievePoliciesMock.mockResolvedValue([]);
    hybridRetrieveMock.mockResolvedValue([]);
    llmMock.mockResolvedValue("I don't have specific policy information to answer that.");

    const res = await orchestrateQuery({
      messages: [{ role: "user", content: "what is the premium for the endowment policy?" }],
    });

    expect(retrievePoliciesMock).toHaveBeenCalled();
    const prompt = llmMock.mock.calls[0][0][0].content as string;
    expect(prompt).toContain("NEVER fabricate");
    expect(res.content).toContain("I don't have specific policy information");
  });
});
