import { describe, it, expect, vi, afterEach } from "vitest";
import {
  applyRRFS,
  applySemanticRerank,
  rerank,
} from "@/lib/ai/agents/reranker";
import type { ContextResult } from "@/lib/ai/agents/types";

function result(id: string, source: ContextResult["source"], content = ""): ContextResult {
  return { id, source, score: 1, content };
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

  it("rerank falls back to rrfs method when embeddings are unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, statusText: "Bad Request" }))
    );

    const candidates = [result("a", "qdrant"), result("b", "postgres_fts")];

    const { results, method } = await rerank("critical illness", candidates);

    expect(method).toBe("semantic");
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
});
