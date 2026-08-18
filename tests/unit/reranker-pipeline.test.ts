import { describe, it, expect, vi, afterEach } from "vitest";
import {
  applyRRFS,
  applySemanticRerank,
  applyProductAwareRerank,
  rerank,
} from "@/lib/ai/agents/reranker";
import type { ContextResult } from "@/lib/ai/agents/types";

function result(id: string, source: ContextResult["source"], content = "", overrides: Partial<ContextResult> = {}): ContextResult {
  return { id, source, score: 1, content, ...overrides };
}

function qdrantResult(id: string, brochureId: string, brochureName: string, content: string, score: number, pageNum?: number): ContextResult {
  return {
    id,
    source: "qdrant",
    score,
    content,
    metadata: { brochure_id: brochureId, brochure_name: brochureName, page_num: pageNum },
  };
}

describe("lib/ai/agents/reranker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applyRRFS assigns reciprocal-rank scores and relevance labels", () => {
    const candidates = [result("a", "postgres_fts"), result("b", "qdrant")];

    const ranked = applyRRFS(candidates);

    expect(ranked).toHaveLength(2);
    expect(ranked[0].rerankedScore).toBeGreaterThan(0);
    expect(ranked[0].relevanceRank).toBe(1);
    expect(ranked.every((r) => typeof r.relevance === "string")).toBe(true);
    expect(ranked.every((r) => typeof r.rerankedScore === "number")).toBe(true);
  });

  it("rerank uses product_aware method (no API calls needed)", async () => {
    const candidates = [result("a", "qdrant"), result("b", "postgres_fts")];

    const { results, method } = await rerank("critical illness", candidates);

    expect(method).toBe("product_aware");
    expect(results).toHaveLength(2);
    expect(results.every((r) => typeof r.rerankedScore === "number")).toBe(true);
  });

  it("applySemanticRerank falls back to RRFS when Ollama is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const candidates = [result("a", "qdrant"), result("b", "postgres_fts")];

    const ranked = await applySemanticRerank("critical illness", candidates, 5);

    expect(ranked).toHaveLength(2);
    expect(ranked[0].rerankedScore).toBeGreaterThan(0);
  });

  it("rerank returns empty results for empty candidates", async () => {
    const { results } = await rerank("anything", []);

    expect(results).toEqual([]);
  });

  describe("applyProductAwareRerank", () => {
    it("boosts brochures whose name matches query keywords", () => {
      const candidates = [
        qdrantResult("c1", "b-term", "Kotak Term Plan", "Life insurance protection", 0.70),
        qdrantResult("c2", "b-tulip", "Kotak TULIP", "Unit linked plan", 0.75),
        qdrantResult("c3", "b-eterm", "Kotak e-Term Plan", "Online term insurance", 0.68),
      ];

      const reranked = applyProductAwareRerank("What is the term plan premium?", candidates, 3);

      expect(reranked).toHaveLength(3);
      // Term Plan brochures should be boosted above TULIP
      expect(reranked[0].metadata?.brochure_name).toMatch(/term/i);
    });

    it("returns empty for empty candidates", () => {
      expect(applyProductAwareRerank("query", [], 5)).toEqual([]);
    });

    it("preserves all candidates up to topN", () => {
      const candidates = Array.from({ length: 8 }, (_, i) =>
        qdrantResult(`c${i}`, `b${i}`, `Product ${i}`, `content ${i}`, 0.5 + i * 0.03)
      );

      const reranked = applyProductAwareRerank("product", candidates, 5);

      expect(reranked).toHaveLength(5);
      expect(reranked.every((r) => typeof r.rerankedScore === "number")).toBe(true);
      expect(reranked.every((r) => typeof r.relevanceRank === "number")).toBe(true);
    });

    it("assigns relevance labels based on composite score", () => {
      const candidates = [
        qdrantResult("c1", "b1", "Kotak Term Plan", "Term insurance protection", 0.85),
        qdrantResult("c2", "b2", "Kotak TULIP", "Unit linked investment", 0.30),
      ];

      const reranked = applyProductAwareRerank("term plan insurance", candidates, 2);

      // Term Plan should get high relevance (name match + high score)
      expect(reranked[0].relevance).toBe("high");
      expect(reranked[1].relevance).toBe("low");
    });

    it("boosts brochures with multiple chunks (diversity)", () => {
      const candidates = [
        qdrantResult("c1", "b-multi", "Multi Chunk Product", "content 1", 0.65),
        qdrantResult("c2", "b-multi", "Multi Chunk Product", "content 2", 0.63),
        qdrantResult("c3", "b-multi", "Multi Chunk Product", "content 3", 0.61),
        qdrantResult("c4", "b-single", "Single Chunk Product", "content", 0.68),
      ];

      const reranked = applyProductAwareRerank("query", candidates, 4);

      // Multi-chunk product should be ranked first despite lower individual score
      expect(reranked[0].metadata?.brochure_name).toBe("Multi Chunk Product");
    });
  });
});
