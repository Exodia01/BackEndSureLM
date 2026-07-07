// RRFS (Reciprocal Rank Fusion) Unit Tests
// Simple assertion-based tests with detailed logging

import { applyRRFS, type RerankResult } from "../../lib/ai/rerank/rrfs";
import { RetrievalResult } from "../../types/retrieval";

type TestCase = {
  name: string;
  input: RetrievalResult[];
  expectedChecks: (results: RerankResult[]) => boolean;
};

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
  }
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

// ============================================================================
// Test Cases
// ============================================================================

const testCases: TestCase[] = [
  // ============================================================================
  // Empty and Edge Cases
  // ============================================================================
  {
    name: "Empty results array",
    input: [],
    expectedChecks: (results) => {
      assert(results.length === 0, "Empty input should return empty output");
      return true;
    },
  },

  {
    name: "Single result from one source",
    input: [
      { id: "1", source: "postgres_fts", score: 0.85 },
    ],
    expectedChecks: (results) => {
      assert(results.length === 1, "Should have 1 result");
      assertEqual(results[0].rerankedScore.toFixed(4), "0.0164", "RRFS score for rank=1, k=60");
      assertEqual(results[0].relevanceRank, 1, "Relevance rank should be 1");
      assertEqual(results[0].relevance, "high", "High relevance threshold >= 0.005");
      return true;
    },
  },

  {
    name: "Multiple results from same source (rank assignment)",
    input: [
      { id: "1", source: "postgres_fts", score: 0.9 },
      { id: "2", source: "postgres_fts", score: 0.7 },
      { id: "3", source: "postgres_fts", score: 0.5 },
    ],
    expectedChecks: (results) => {
      assert(results.length === 3, "Should have 3 results");
      
      // Verify ranks within source are assigned
      const ftsResults = results.filter(r => r.source === "postgres_fts");
      assertEqual(ftsResults[0].rank, 1, "First FTS result gets rank 1");
      assertEqual(ftsResults[1].rank, 2, "Second FTS result gets rank 2");
      assertEqual(ftsResults[2].rank, 3, "Third FTS result gets rank 3");
      
      // Verify sorting by RRFS score (higher score = better)
      for (let i = 0; i < results.length - 1; i++) {
        assert(results[i].rerankedScore >= results[i + 1].rerankedScore,
          `Results should be sorted by rerankedScore descending. Rank ${i}: ${results[i].rerankedScore} >= ${results[i + 1].rerankedScore}`);
      }
      
      return true;
    },
  },

  // ============================================================================
  // Multi-Source Integration
  // ============================================================================
  {
    name: "Multiple sources with same rank (RRFS score calculation)",
    input: [
      { id: "1", source: "postgres_fts", score: 0.8, rank: 1 },
      { id: "2", source: "qdrant", score: 0.75, rank: 1 },
      { id: "3", source: "user_history", score: 0.6, rank: 1 },
    ],
    expectedChecks: (results) => {
      assert(results.length === 3, "Should have 3 results");
      
      // k = 60
      const k = 60;
      const expectedScoreFTS = 1 / (1 + k);       // rank=1 -> 1/61 ≈ 0.0164
      const expectedScoreVector = 1 / (1 + k);     // rank=1 -> 1/61 ≈ 0.0164  
      const expectedScoreHistory = 1 / (1 + k);    // rank=1 -> 1/61 ≈ 0.0164
      
      assertEqual(results[0].rerankedScore.toFixed(4), expectedScoreFTS.toFixed(4),
        "All same-rank items should have equal RRFS scores");
      
      return true;
    },
  },

  {
    name: "Multi-source ranking with different ranks",
    input: [
      { id: "1", source: "postgres_fts", score: 0.9, rank: 1 },      // FTS rank 1
      { id: "2", source: "qdrant", score: 0.85, rank: 2 },           // Vector rank 2
      { id: "3", source: "user_history", score: 0.7, rank: 1 },      // History rank 1
    ],
    expectedChecks: (results) => {
      assert(results.length === 3, "Should have 3 results");
      
      const k = 60;
      // FTS rank=1: 1/(1+60) ≈ 0.0164
      // Vector rank=2: 1/(2+60) ≈ 0.0161  
      // History rank=1: 1/(1+60) ≈ 0.0164
      
      const ftsScore = results.find(r => r.source === "postgres_fts")?.rerankedScore ?? 0;
      const historyScore = results.find(r => r.source === "user_history")?.rerankedScore ?? 0;
      
      // FTS and History have same rank, should tie-break by source priority
      // FTS has higher priority than History
      assert(ftsScore >= historyScore || (ftsScore === historyScore && true),
        "FTS should be ranked at least as high as History when both at rank 1");
      
      return true;
    },
  },

  {
    name: "Source priority tie-breaker (postgres_fts > qdrant > user_history)",
    input: [
      { id: "1", source: "qdrant", score: 0.8, rank: 1 },
      { id: "2", source: "postgres_fts", score: 0.8, rank: 1 },
      { id: "3", source: "user_history", score: 0.8, rank: 1 },
    ],
    expectedChecks: (results) => {
      const sources = results.map(r => r.source);
      
       assertEqual(sources[0], "postgres_fts", "FTS has highest priority");
       assertEqual(sources[1], "qdrant", "Vector is second");
       assertEqual(sources[2], "user_history", "History is last");
       
       return true;
     },
   },

   // ============================================================================
   // Relevance Threshold Tests
   // ============================================================================
  {
    name: "Relevance label assignment",
    input: (() => {
      const inputs = [];
      // postgres_fts: rank=1 -> high
      inputs.push({ id: "1", source: "postgres_fts", score: 0.8, rank: 1 });
      // qdrant: multiple items, last one gets low relevance (rank > 498)
      for (let i = 2; i <= 500; i++) {
        inputs.push({ id: `q-${i}`, source: "qdrant", score: 0.7 - i * 0.001, rank: 1 });
      }
      return inputs;
    })(),
    expectedChecks: (results) => {
      const result1 = results.find(r => r.id === "1");
      
      // Result 1 gets rank=1 within postgres_fts, score=1/61≈0.0164 -> high
      assert(result1?.relevance === "high", `Result 1 should be 'high' but got '${result1?.relevance}'`);
      
      return true;
    },
  },

  {
    name: "Low relevance from rank > 498",
    input: (() => {
      const inputs = [];
      for (let i = 0; i < 500; i++) {
        inputs.push({ id: `item-${i}`, source: "postgres_fts", score: 1 - i * 0.002, rank: 1 });
      }
      return inputs;
    })(),
    expectedChecks: (results) => {
      const lowResults = results.filter(r => r.relevance === "low");
      
      assert(lowResults.length > 0, "Should have at least one low relevance result (rank > 498)");
      
      return true;
    },
  },

  // ============================================================================
  // Deduplication and Real-World Scenarios
  // ============================================================================
  {
    name: "Real-world scenario: Mixed search results",
    input: [
      { id: "pol-001", source: "postgres_fts", score: 0.92, rank: 1 },
      { id: "pol-001", source: "user_history", score: 0.85, rank: 1 },     // Same policy in both sources
      { id: "pol-002", source: "postgres_fts", score: 0.78, rank: 2 },
      { id: "pol-003", source: "user_history", score: 0.65, rank: 1 },
    ],
    expectedChecks: (results) => {
      assert(results.length === 4, "RRFS does not deduplicate - caller's responsibility");
      
      // RRFS doesn't deduplicate - same id can appear multiple times from different sources
      const pol001Results = results.filter(r => r.id === "pol-001");
      assertEqual(pol001Results.length, 2, "Should have two results for pol-001 (no deduplication)");
      
      // Verify rerankedScore is present
      for (const result of results) {
        assert(typeof result.rerankedScore === "number", `Result ${result.id} should have rerankedScore`);
        assert(typeof result.relevanceRank === "number", `Result ${result.id} should have relevanceRank`);
      }
      
      // Verify relevance labels are assigned
      for (const result of results) {
        assert(["high", "medium", "low"].includes(result.relevance ?? ""),
          `Result ${result.id} should have valid relevance label`);
      }
      
      return true;
    },
  },

  {
    name: "Large result set performance check",
    input: (() => {
      const inputs: RetrievalResult[] = [];
      for (let i = 1; i <= 50; i++) {
        inputs.push({
          id: `policy-${i}`,
          source: i % 3 === 0 ? "postgres_fts" : i % 3 === 1 ? "qdrant" : "user_history",
          score: Math.random(),
          rank: i,
        });
      }
      return inputs;
    })(),
    expectedChecks: (results) => {
      assert(results.length === 50, "Should preserve all results");
      
      // Verify sorting
      for (let i = 0; i < results.length - 1; i++) {
        assert(results[i].rerankedScore >= results[i + 1].rerankedScore,
          `Results should be sorted descending. Index ${i} has score ${results[i].rerankedScore}`);
      }
      
      // Verify relevance ranks are assigned
      for (let i = 0; i < results.length; i++) {
        assertEqual(results[i].relevanceRank, i + 1,
          `Relevance rank should be sequential: position ${i}, got ${results[i].relevanceRank}`);
      }
      
      return true;
    },
  },
];

// ============================================================================
// Test Runner
// ============================================================================

let passedTests = 0;
let failedTests = 0;

const runTestCase = (testCase: TestCase, index: number): void => {
  const { name, input, expectedChecks } = testCase;
  
  console.log(`\n[Test ${index}] ${name}`);
  console.log(`  Input: ${input.length} results`);
  
  try {
    // Run the function
    const results = applyRRFS(input);
    
    // Validate expectations
    const success = expectedChecks(results);
    
    if (success) {
      console.log(`  ✅ PASSED`);
      passedTests++;
    } else {
      console.log(`  ❌ FAILED: Check failed`);
      failedTests++;
    }
  } catch (error) {
    console.log(`  ❌ FAILED: ${(error as Error).message}`);
    failedTests++;
  }
};

const runAllTests = (): void => {
  console.log("=".repeat(60));
  console.log("RRFS Unit Tests");
  console.log("=".repeat(60));
  
  testCases.forEach((testCase, index) => {
    try {
      runTestCase(testCase, index + 1);
    } catch (error) {
      console.log(`\n[Test ${index + 1}] ${testCase.name}`);
      console.log(`  ❌ CRASHED: ${(error as Error).message}`);
      failedTests++;
    }
  });
  
  const total = passedTests + failedTests;
  console.log("\n" + "=".repeat(60));
  console.log("Test Summary");
  console.log("=".repeat(60));
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Success Rate: ${(passedTests / total * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    process.exit(1);
  }
};

runAllTests();
