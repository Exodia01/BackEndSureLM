import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  policy: {
    findMany: vi.fn(),
  },
  policyBrochure: {
    findMany: vi.fn(),
  },
  brochure: {
    findMany: vi.fn(),
  },
};

const semanticSearchMock = vi.fn();

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/qdrant", () => ({
  semanticSearch: (...args: unknown[]) => semanticSearchMock(...args),
  POLICY_KNOWLEDGE_COLLECTION: "policy_knowledge",
}));

const {
  retrievePoliciesWithContext,
  getRecommendablePolicies,
  resolveRecommendablePolicyIds,
} = await import("@/lib/ai/agents/retriever");

describe("policy-aware retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when no vector is provided (graceful empty)", async () => {
    const result = await retrievePoliciesWithContext("term plan", []);
    expect(result).toEqual([]);
    expect(semanticSearchMock).not.toHaveBeenCalled();
  });

  it("getRecommendablePolicies restricts to active policies with a current version", async () => {
    dbMock.policy.findMany.mockResolvedValue([
      { id: "p1", isActive: true, currentVersionId: "v1" },
    ]);
    const result = await getRecommendablePolicies();
    expect(dbMock.policy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, currentVersionId: { not: null } },
      })
    );
    expect(result).toHaveLength(1);
  });

  it("resolveRecommendablePolicyIds returns just IDs", async () => {
    dbMock.policy.findMany.mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
    ]);
    const ids = await resolveRecommendablePolicyIds();
    expect(ids).toEqual(["p1", "p2"]);
  });

  it("filters to approved policies via brochure join when onlyApproved is set", async () => {
    dbMock.policy.findMany.mockResolvedValue([
      { id: "p1", isActive: true, currentVersionId: "v1" },
    ]);
    dbMock.policyBrochure.findMany.mockResolvedValue([
      { brochureId: "b1" },
      { brochureId: "b2" },
    ]);
    semanticSearchMock.mockResolvedValue([]);

    const result = await retrievePoliciesWithContext(
      "retirement plan",
      [0.1, 0.2],
      { onlyApproved: true, limit: 5 }
    );

    expect(dbMock.policyBrochure.findMany).toHaveBeenCalledWith({
      where: { policyId: { in: ["p1"] } },
      select: { brochureId: true },
    });
    expect(semanticSearchMock).toHaveBeenCalledWith(
      [0.1, 0.2],
      {
        should: [
          { key: "brochure_id", match: { value: "b1" } },
          { key: "brochure_id", match: { value: "b2" } },
        ],
      },
      "policy_knowledge",
      5
    );
    expect(result).toEqual([]);
  });

  it("filters by explicit policyIds without approval gating", async () => {
    dbMock.policyBrochure.findMany.mockResolvedValue([
      { brochureId: "b9" },
    ]);
    dbMock.brochure.findMany.mockResolvedValue([]);
    semanticSearchMock.mockResolvedValue([
      {
        id: "chunk-1",
        score: 0.9,
        payload: {
          chunk_id: "chunk-1",
          brochure_id: "b9",
          content: "Entry age 18 to 65.",
          page_num: 3,
        },
      },
    ]);

    const result = await retrievePoliciesWithContext(
      "entry age",
      [0.3],
      { policyIds: ["p3"] }
    );

    expect(dbMock.policyBrochure.findMany).toHaveBeenCalledWith({
      where: { policyId: { in: ["p3"] } },
      select: { brochureId: true },
    });
    expect(result).toHaveLength(1);
    // No policy linkage exists, so provenance is brochure-level only.
    expect(result[0].metadata).toMatchObject({
      chunk_id: "chunk-1",
      brochure_id: "b9",
    });
    expect(result[0].policyId).toBeUndefined();
  });

  it("enriches provenance with brochure + policy + version when linked", async () => {
    dbMock.policyBrochure.findMany.mockResolvedValue([
      { brochureId: "b1" },
    ]);
    dbMock.brochure.findMany.mockResolvedValue([
      { id: "b1", basename: "kotak_premier_life", originalName: "Kotak Premier Life.pdf" },
    ]);
    semanticSearchMock.mockResolvedValue([
      {
        id: "chunk-1",
        score: 0.9,
        payload: {
          chunk_id: "chunk-1",
          brochure_id: "b1",
          content: "Sum assured min 5 lakh.",
          page_num: 2,
        },
      },
      {
        id: "chunk-2",
        score: 0.7,
        payload: {
          chunk_id: "chunk-1",
          brochure_id: "b1",
          content: "Duplicate of chunk-1.",
          page_num: 2,
        },
      },
    ]);

    // Mock the PolicyBrochure policy include via the findMany resolution.
    const links = [
      {
        brochureId: "b1",
        policy: {
          id: "p1",
          name: "Kotak Premier Life",
          provider: "Kotak",
          currentVersion: { id: "v2", versionNum: 2, label: "v2", publishedAt: new Date() },
        },
      },
    ];
    dbMock.policyBrochure.findMany
      .mockResolvedValueOnce([{ brochureId: "b1" }])
      .mockResolvedValueOnce(links);

    const result = await retrievePoliciesWithContext(
      "sum assured",
      [0.5],
      { policyIds: ["p1"] }
    );

    expect(result).toHaveLength(1); // deterministic dedup keeps highest score
    expect(result[0].policyId).toBe("p1");
    expect(result[0].policyName).toBe("Kotak Premier Life");
    expect(result[0].metadata).toMatchObject({
      brochure_name: "kotak_premier_life",
      policy_id: "p1",
      policy_name: "Kotak Premier Life",
      policy_version_num: 2,
      policy_version_id: "v2",
      query: "sum assured",
    });
    expect(result[0].score).toBe(0.9);
  });

  it("sorts deterministic deduplicated results by score desc", async () => {
    dbMock.policyBrochure.findMany.mockResolvedValue([{ brochureId: "b1" }]);
    dbMock.brochure.findMany.mockResolvedValue([{ id: "b1", basename: "b", originalName: "b" }]);
    semanticSearchMock.mockResolvedValue([
      {
        id: "c2",
        score: 0.4,
        payload: { chunk_id: "c2", brochure_id: "b1", content: "two" },
      },
      {
        id: "c1",
        score: 0.8,
        payload: { chunk_id: "c1", brochure_id: "b1", content: "one" },
      },
    ]);
    dbMock.policyBrochure.findMany
      .mockResolvedValueOnce([{ brochureId: "b1" }])
      .mockResolvedValueOnce([]);

    const result = await retrievePoliciesWithContext("q", [0.1]);
    expect(result.map((r) => r.id)).toEqual(["c1", "c2"]);
  });

  it("handles Qdrant results with no matching brochure links safely", async () => {
    dbMock.policyBrochure.findMany.mockResolvedValue([{ brochureId: "b1" }]);
    dbMock.brochure.findMany.mockResolvedValue([]);
    semanticSearchMock.mockResolvedValue([
      {
        id: "c1",
        score: 0.6,
        payload: { chunk_id: "c1", brochure_id: "b1", content: "orphan" },
      },
    ]);
    dbMock.policyBrochure.findMany
      .mockResolvedValueOnce([{ brochureId: "b1" }])
      .mockResolvedValueOnce([]);

    const result = await retrievePoliciesWithContext("q", [0.1]);
    expect(result).toHaveLength(1);
    expect(result[0].metadata?.brochure_id).toBe("b1");
    expect(result[0].policyId).toBeUndefined();
  });
});
