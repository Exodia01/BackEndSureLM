import { describe, it, expect } from "vitest";
import { cosineSimilarity } from "@/lib/ai/rerank/reranker";

describe("Cosine Similarity", () => {
  it("should compute similarity between two vectors", async () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];

    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it("should compute high similarity for identical vectors", async () => {
    const v = [0.5, -0.3, 0.8];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("should handle zero-norm vectors gracefully", async () => {
    const zeroVec = [0, 0, 0];
    const normalVec = [1, 2, 3];

    expect(cosineSimilarity(zeroVec, normalVec)).toBe(0);
  });

  it("should return values between -1 and 1", async () => {
    const a = [1, 2, 3, 4];
    const b = [4, 3, 2, 1];

    expect(cosineSimilarity(a, b)).toBeGreaterThanOrEqual(-1);
    expect(cosineSimilarity(a, b)).toBeLessThanOrEqual(1);
  });
});
