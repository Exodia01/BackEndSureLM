// History Boost Unit Tests - Manual implementation for testing

const MAX_BOOST = 0.15;
const BOOST_PER_ISSUANCE = MAX_BOOST / 5;

type RetrievalResult = {
  id: string;
  source: "postgres_fts" | "qdrant" | "user_history";
  score: number;
  historyCount?: number;
};

function applyHistoryBoostManual(results: RetrievalResult[], agentId?: string): RetrievalResult[] {
  if (!agentId || !results.length) return results;

  return results.map((result) => {
    const count = mockCounts[result.id] ?? 0;

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

let mockCounts: Record<string, number> = {};

type TestCase = {
  name: string;
  input: RetrievalResult[];
  agentId?: string | null;
  expectedResults: RetrievalResult[];
};

const testCases: TestCase[] = [
  {
    name: "No boost when agentId is undefined",
    input: [{ id: "pol-001", source: "postgres_fts", score: 0.8 }],
    agentId: undefined,
    expectedResults: [{ id: "pol-001", source: "postgres_fts", score: 0.8, historyCount: undefined }],
  },
  {
    name: "No boost when agentId is null",
    input: [{ id: "pol-001", source: "postgres_fts", score: 0.8 }],
    agentId: null,
    expectedResults: [{ id: "pol-001", source: "postgres_fts", score: 0.8, historyCount: undefined }],
  },
  {
    name: "Boost calculated correctly with count=3",
    input: [{ id: "pol-boost", source: "postgres_fts", score: 0.8 }],
    agentId: "agent-test",
    expectedResults: [
      {
        id: "pol-boost",
        source: "postgres_fts",
        score: Number((0.8 + Math.min(3 * BOOST_PER_ISSUANCE, MAX_BOOST)).toFixed(4)),
        historyCount: 3,
      },
    ],
    onBeforeEach: () => {
      mockCounts = { "pol-boost": 3 };
    },
  },
  {
    name: "Boost capped at max 0.15 with count=20",
    input: [{ id: "pol-capped", source: "postgres_fts", score: 0.8 }],
    agentId: "agent-test",
    expectedResults: [
      {
        id: "pol-capped",
        source: "postgres_fts",
        score: Number((0.8 + MAX_BOOST).toFixed(4)),
        historyCount: 20,
      },
    ],
    onBeforeEach: () => {
      mockCounts = { "pol-capped": 20 };
    },
  },
  {
    name: "Score capped at 1.0 even with high boost",
    input: [{ id: "pol-capped-score", source: "postgres_fts", score: 0.95 }],
    agentId: "agent-test",
    expectedResults: [
      {
        id: "pol-capped-score",
        source: "postgres_fts",
        score: 1.0,
        historyCount: 20,
      },
    ],
    onBeforeEach: () => {
      mockCounts = { "pol-capped-score": 20 };
    },
  },
  {
    name: "Empty results array",
    input: [],
    agentId: "agent-test",
    expectedResults: [],
    onBeforeEach: () => {
      mockCounts = {};
    },
  },
];

let passedTests = 0;
let failedTests = 0;

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
  }
};

const runAllTests = async (): Promise<void> => {
  console.log("History Boost Unit Tests");

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    try {
      if (testCase.onBeforeEach) {
        testCase.onBeforeEach();
      }

      const results = applyHistoryBoostManual(testCase.input, testCase.agentId as any);

      let passed = true;
      for (let j = 0; j < testCase.expectedResults.length; j++) {
        const result = results[j];
        const expected = testCase.expectedResults[j];

        assertEqual(
          result?.score.toFixed(4),
          expected.score.toFixed(4),
          `Result ${j} (${expected.id}) score mismatch`
        );
        assertEqual(result?.historyCount, expected.historyCount, `Result ${j} (${expected.id}) historyCount mismatch`);
      }

      console.log(`\nTest ${i + 1} PASSED: ${testCase.name}`);
      passedTests++;
    } catch (error: any) {
      console.log(`\nTest ${i + 1} FAILED: ${testCase.name}`);
      console.log(`  Error: ${(error as Error).message}`);
      failedTests++;
    }
  }

  console.log(`\nTotal Tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}, Failed: ${failedTests}`);

  if (failedTests > 0) {
    process.exit(1);
  }
};

runAllTests();
