import { describe, it, expect } from "vitest";
import { scoreToRelevance } from "../../lib/ai/hybridRetrieval";

describe("scoreToRelevance - Unit Tests", () => {
  it("should return 'high' for scores >= 0.7", () => {
    expect(scoreToRelevance(0.7)).toBe("high");
    expect(scoreToRelevance(1.0)).toBe("high");
    expect(scoreToRelevance(0.95)).toBe("high");
  });

  it("should return 'medium' for scores >= 0.4 and < 0.7", () => {
    expect(scoreToRelevance(0.4)).toBe("medium");
    expect(scoreToRelevance(0.69)).toBe("medium");
    expect(scoreToRelevance(0.55)).toBe("medium");
  });

  it("should return 'low' for scores < 0.4", () => {
    expect(scoreToRelevance(0.39)).toBe("low");
    expect(scoreToRelevance(0.0)).toBe("low");
    expect(scoreToRelevance(0.1)).toBe("low");
  });

  it("should return 'high' at boundary 0.70", () => {
    expect(scoreToRelevance(0.70)).toBe("high");
  });

  it("should return 'medium' just below 0.70 (0.69)", () => {
    expect(scoreToRelevance(0.69)).toBe("medium");
  });

  it("should return 'medium' at boundary 0.40", () => {
    expect(scoreToRelevance(0.40)).toBe("medium");
  });

  it("should return 'low' just below 0.40 (0.39)", () => {
    expect(scoreToRelevance(0.39)).toBe("low");
  });
});
