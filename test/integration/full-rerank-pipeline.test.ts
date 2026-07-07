import { describe, it, expect } from "vitest";
import { checkOllamaHealth } from "./utils";
import { rerank } from "@/lib/ai/rerank/reranker";

describe("Full Reranking Pipeline", () => {
  beforeAll(async () => {
    await checkOllamaHealth();
  });

  it("should rerank candidates with real embeddings from bge-m3 model", async () => {
    const query = "premium payment term";
    
    const candidates = [
      createMockCandidate({
        id: "c1",
        content: "Premium can be paid monthly, quarterly, or yearly based on policy terms"
      }),
      createMockCandidate({
        id: "c2",
        content: "Policyholders must pay premiums regularly to maintain coverage"
      }),
      createMockCandidate({
        id: "c3", 
        content: "Annual premium payments receive a 5% discount"
      })
    ];

    const results = await rerank(query, candidates, 3);

    expect(results.length).toBe(3);
    expect(results[0]).toHaveProperty("rerankedScore");
    expect(typeof results[0].rerankedScore).toBe("number");
  });

  it("should sort results by rerankedScore in descending order", async () => {
    const query = "test query";
    
    const candidates = Array.from({ length: 5 }, (_, i) =>
      createMockCandidate({
        id: `c${i}`,
        content: `Document snippet ${i} with different relevance levels`
      })
    );

    const results = await rerank(query, candidates, 5);

    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].rerankedScore).toBeGreaterThanOrEqual(
        results[i + 1].rerankedScore
      );
    }
  });

  it("should assign correct relevance levels based on scores", async () => {
    const query = "maturity benefit";
    
    const candidates = Array.from({ length: 3 }, (_, i) =>
      createMockCandidate({
        id: `c${i}`,
        content: `Result with score level ${i}`
      })
    );

    const results = await rerank(query, candidates, 3);

    results.forEach((r) => {
      expect(["high", "medium", "low"]).toContain(r.relevance);
    });
  });

  it("should handle empty candidate list gracefully", async () => {
    const query = "test";
    
    const results = await rerank(query, [], 5);
    
    expect(results.length).toBe(0);
  });
});

function createMockCandidate(options: {
  id?: string;
  content?: string;
  score?: number;
}): any {
  return {
    id: options.id || `chunk-${Date.now()}`,
    source: "fts" as const,
    score: options.score ?? 0.5,
    payload: {
      chunk_id: options.id,
      content_snippet: options.content || "default content"
    },
    content: options.content
  };
}
