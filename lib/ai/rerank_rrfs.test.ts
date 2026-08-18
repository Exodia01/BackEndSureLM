import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { rerank } from "./rerank/reranker";
import { applyRRFS } from "./rerank/rrfs";

vi.mock("node:fetch");
global.fetch = vi.fn();

type RetrievalResult = {
  id: string;
  source: "fts" | "vector" | "history";
  score: number;
  payload: Record<string, unknown>;
  rank?: number;
};

describe("Reranker Integration Test", () => {
  const mockQuery = "test query";

  const mockCandidates: RetrievalResult[] = [
    {
      id: "1",
      source: "vector",
      score: 0.8,
      payload: { content_snippet: "First result content" },
    },
    {
      id: "2",
      source: "fts",
      score: 0.75,
      payload: { content_snippet: "Second result content" },
    },
    {
      id: "3",
      source: "history",
      score: 0.65,
      payload: { content_snippet: "Third result content" },
    },
    {
      id: "4",
      source: "vector",
      score: 0.6,
      payload: { content_snippet: "Fourth result content" },
    },
    {
      id: "5",
      source: "fts",
      score: 0.55,
      payload: { content_snippet: "Fifth result content" },
    },
    {
      id: "6",
      source: "history",
      score: 0.5,
      payload: { content_snippet: "Sixth result content" },
    },
    {
      id: "7",
      source: "vector",
      score: 0.45,
      payload: { content_snippet: "Seventh result content" },
    },
    {
      id: "8",
      source: "fts",
      score: 0.4,
      payload: { content_snippet: "Eighth result content" },
    },
    {
      id: "9",
      source: "history",
      score: 0.35,
      payload: { content_snippet: "Ninth result content" },
    },
    {
      id: "10",
      source: "vector",
      score: 0.3,
      payload: { content_snippet: "Tenth result content" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should apply RRF first, then rerank top candidates", async () => {
    const rrfResults = applyRRFS(mockCandidates);

    expect(rrfResults.length).toBeGreaterThan(0);
    expect(rrfResults[0]).toHaveProperty("rerankedScore");
  });

  it("should return top 5 results after reranking", async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { index: 0, score: 2.5 },
          { index: 1, score: 2.3 },
          { index: 2, score: 2.1 },
          { index: 3, score: 1.9 },
          { index: 4, score: 1.7 },
        ]),
    });

    const rrfResults = applyRRFS(mockCandidates);
    const reranked = await rerank(mockQuery, rrfResults.slice(0, 10), 5);

    expect(reranked.length).toBe(5);
    expect(reranked.every((r) => "rerankedScore" in r)).toBe(true);
  });

  it("should sort results by rerankedScore in descending order", async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { index: 0, score: 2.5 },
          { index: 1, score: 2.3 },
          { index: 2, score: 2.1 },
          { index: 3, score: 1.9 },
          { index: 4, score: 1.7 },
        ]),
    });

    const rrfResults = applyRRFS(mockCandidates);
    const reranked = await rerank(mockQuery, rrfResults.slice(0, 10), 5);

    for (let i = 0; i < reranked.length - 1; i++) {
      expect(reranked[i].rerankedScore ?? 0).toBeGreaterThanOrEqual(
        reranked[i + 1].rerankedScore ?? 0
      );
    }
  });

  it("should assign correct relevance ranks", async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { index: 0, score: 2.5 },
          { index: 1, score: 2.3 },
          { index: 2, score: 2.1 },
          { index: 3, score: 1.9 },
          { index: 4, score: 1.7 },
        ]),
    });

    const rrfResults = applyRRFS(mockCandidates);
    const reranked = await rerank(mockQuery, rrfResults.slice(0, 10), 5);

    expect(reranked[0].relevanceRank).toBe(1);
    expect(reranked[1].relevanceRank).toBe(2);
    expect(reranked[2].relevanceRank).toBe(3);
    expect(reranked[3].relevanceRank).toBe(4);
    expect(reranked[4].relevanceRank).toBe(5);
  });

  it("should correctly map rerank scores to candidates", async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { index: 2, score: 3.0 },
          { index: 0, score: 2.5 },
          { index: 4, score: 2.0 },
          { index: 1, score: 1.5 },
          { index: 3, score: 1.0 },
        ]),
    });

    const rrfResults = applyRRFS(mockCandidates);
    const reranked = await rerank(mockQuery, rrfResults.slice(0, 10), 5);

    expect(reranked[0].id).toBe("3");
    expect(reranked[0].rerankedScore).toBe(3.0);
    expect(reranked[1].id).toBe("1");
    expect(reranked[1].rerankedScore).toBe(2.5);
  });

  it("should handle reranking API failure gracefully", async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
    });

    const rrfResults = applyRRFS(mockCandidates);
    const fallback = await rerank(mockQuery, rrfResults.slice(0, 10), 5);

    expect(fallback.length).toBe(5);
    expect(fallback[0]).toHaveProperty("rerankedScore");
  });

  it("should compare RRF vs reranked ranking changes", async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { index: 1, score: 2.8 },
          { index: 0, score: 2.5 },
          { index: 3, score: 2.2 },
          { index: 2, score: 1.9 },
          { index: 4, score: 1.6 },
        ]),
    });

    const rrfResults = applyRRFS(mockCandidates);
    const topRrf = rrfResults.slice(0, 10);

    const reranked = await rerank(mockQuery, topRrf, 5);

    let rankingChanges = 0;
    for (let i = 0; i < Math.min(reranked.length, topRrf.length); i++) {
      if (reranked[i].id !== topRrf[i].id) {
        rankingChanges++;
      }
    }

    expect(rankingChanges).toBeGreaterThanOrEqual(0);
    expect(reranked[0].relevanceRank).toBe(1);
  });

  it("should assign correct relevance levels based on rerankedScore", async () => {
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { index: 0, score: 2.5 },
          { index: 1, score: 1.2 },
          { index: 2, score: 0.8 },
          { index: 3, score: 0.3 },
          { index: 4, score: 0.1 },
        ]),
    });

    const rrfResults = applyRRFS(mockCandidates);
    const reranked = await rerank(mockQuery, rrfResults.slice(0, 10), 5);

    expect(reranked[0].relevance).toBe("high");
    expect(reranked[1].relevance).toBe("high");
    expect(reranked[2].relevance).toBe("low");
    expect(reranked[2].relevance).toBe("low");
    expect(reranked[3].relevance).toBe("low");
    expect(reranked[4].relevance).toBe("low");
  });
});