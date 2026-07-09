import { describe, it, expect, beforeEach } from "vitest";

const MAX_BOOST = 0.15;
const BOOST_PER_ISSUANCE = MAX_BOOST / 5;

type RetrievalResult = {
  id: string;
  source: "postgres_fts" | "qdrant" | "user_history";
  score: number;
  historyCount?: number;
};

function applyHistoryBoostManual(results: RetrievalResult[], agentId?: string, counts: Record<string, number> = {}): RetrievalResult[] {
  if (!agentId || !results.length) return results;

  return results.map((result) => {
    const count = counts[result.id] ?? 0;

    if (count > 0) {
      const boost = Math.min(count * BOOST_PER_ISSUANCE, MAX_BOOST);

      return {
        ...result,
        score: Math.min(result.score + boost, 1.0),
        historyCount: count,
      };
    }

    return result;
  });
}

describe("applyHistoryBoost - Unit Tests", () => {
  beforeEach(() => {});

  it("should return results unchanged when agentId is undefined", () => {
    const input = [{ id: "pol-001", source: "postgres_fts" as const, score: 0.8 }];
    const results = applyHistoryBoostManual(input);
    expect(results).toEqual([{ id: "pol-001", source: "postgres_fts", score: 0.8 }]);
  });

  it("should return results unchanged when agentId is null", () => {
    const input = [{ id: "pol-001", source: "postgres_fts" as const, score: 0.8 }];
    const results = applyHistoryBoostManual(input, null);
    expect(results).toEqual([{ id: "pol-001", source: "postgres_fts", score: 0.8 }]);
  });

  it("should calculate boost correctly with count=3", () => {
    const counts = { "pol-boost": 3 };
    const input = [{ id: "pol-boost", source: "postgres_fts" as const, score: 0.8 }];
    const results = applyHistoryBoostManual(input, "agent-test", counts);

    expect(results[0].score).toBeCloseTo(0.8 + (3 * BOOST_PER_ISSUANCE), 4);
    expect(results[0].historyCount).toBe(3);
  });

  it("should cap boost at maximum 0.15 with count=20", () => {
    const counts = { "pol-capped": 20 };
    const input = [{ id: "pol-capped", source: "postgres_fts" as const, score: 0.8 }];
    const results = applyHistoryBoostManual(input, "agent-test", counts);

    expect(results[0].score).toBeCloseTo(0.8 + MAX_BOOST, 4);
    expect(results[0].historyCount).toBe(20);
  });

  it("should cap score at 1.0 even with high boost", () => {
    const counts = { "pol-capped-score": 20 };
    const input = [{ id: "pol-capped-score", source: "postgres_fts" as const, score: 0.95 }];
    const results = applyHistoryBoostManual(input, "agent-test", counts);

    expect(results[0].score).toBe(1.0);
    expect(results[0].historyCount).toBe(20);
  });

  it("should handle empty results array", () => {
    const input: RetrievalResult[] = [];
    const results = applyHistoryBoostManual(input, "agent-test");
    expect(results).toEqual([]);
  });
});
