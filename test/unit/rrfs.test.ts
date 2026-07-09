import { describe, it, expect } from "vitest";
import { applyRRFS } from "../../lib/ai/rerank/rrfs";

describe("applyRRFS - Unit Tests", () => {
  it("should handle empty results array", () => {
    const results = applyRRFS([]);
    expect(results).toEqual([]);
  });

  it("should assign rank within source groups", () => {
    const results = applyRRFS([
      { id: "1", source: "postgres_fts" as const, score: 0.8 },
      { id: "2", source: "postgres_fts" as const, score: 0.7 },
      { id: "3", source: "qdrant" as const, score: 0.9 },
    ]);

    expect(results.find(r => r.id === "1")?.rank).toBe(1);
    expect(results.find(r => r.id === "2")?.rank).toBe(2);
    expect(results.find(r => r.id === "3")?.rank).toBe(1);
  });

  it("should calculate RRFS scores correctly", () => {
    const results = applyRRFS([
      { id: "1", source: "postgres_fts" as const, score: 0.9 },
    ]);

    expect(results[0].rerankedScore).toBeCloseTo(1 / (1 + 60), 4);
  });

  it("should sort by rerankedScore descending", () => {
    const results = applyRRFS([
      { id: "1", source: "postgres_fts" as const, score: 0.5 },
      { id: "2", source: "qdrant" as const, score: 0.8 },
    ]);

    expect(results[0].rerankedScore).toBeGreaterThanOrEqual(results[1].rerankedScore);
  });

  it("should sort by source priority when scores tie (fts > vector > history)", () => {
    const results = applyRRFS([
      { id: "1", source: "qdrant" as const, score: 0.8, rank: 1 },
      { id: "2", source: "postgres_fts" as const, score: 0.8, rank: 1 },
      { id: "3", source: "user_history" as const, score: 0.8, rank: 1 },
    ]);

    expect(results[0].source).toBe("postgres_fts");
    expect(results[1].source).toBe("qdrant");
    expect(results[2].source).toBe("user_history");
  });

  it("should assign relevance labels correctly", () => {
    const results = applyRRFS([
      { id: "1", source: "postgres_fts" as const, score: 0.9, rank: 1 },
    ]);

    expect(results[0].relevance).toBe("high");
  });

  it("should assign relevance ranks sequentially after sorting", () => {
    const results = applyRRFS([
      { id: "1", source: "postgres_fts" as const, score: 0.9 },
      { id: "2", source: "qdrant" as const, score: 0.8 },
      { id: "3", source: "user_history" as const, score: 0.7 },
    ]);

    expect(results[0].relevanceRank).toBe(1);
    expect(results[1].relevanceRank).toBe(2);
    expect(results[2].relevanceRank).toBe(3);
  });
});
