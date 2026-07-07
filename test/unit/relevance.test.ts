// Relevance score tests - runs with tsx or node
import { scoreToRelevance } from "../../lib/ai/hybridRetrieval";

type TestCase = {
  name: string;
  input: number;
  expected: "high" | "medium" | "low";
};

const testCases: TestCase[] = [
  { name: "returns 'high' for scores >= 0.7", input: 0.7, expected: "high" },
  { name: "returns 'medium' for scores >= 0.4 and < 0.7", input: 0.5, expected: "medium" },
  { name: "returns 'low' for scores < 0.4", input: 0.2, expected: "low" },
  { name: "returns 'high' at boundary 0.70", input: 0.70, expected: "high" },
  { name: "returns 'medium' just below 0.70 (0.69)", input: 0.69, expected: "medium" },
  { name: "returns 'medium' at boundary 0.40", input: 0.40, expected: "medium" },
  { name: "returns 'low' just below 0.40 (0.39)", input: 0.39, expected: "low" },
];

let passedTests = 0;
let failedTests = 0;

testCases.forEach((tc) => {
  try {
    const result = scoreToRelevance(tc.input);
    if (result === tc.expected) {
      console.log(`✅ ${tc.name}`);
      passedTests++;
    } else {
      console.log(`❌ ${tc.name} - Expected '${tc.expected}', got '${result}'`);
      failedTests++;
    }
  } catch (error: any) {
    console.log(`❌ ${tc.name} - Error: ${error.message}`);
    failedTests++;
  }
});

const total = passedTests + failedTests;
console.log("\n" + "=".repeat(50));
console.log("Test Summary");
console.log("=".repeat(50));
console.log(`Total Tests: ${total}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Success Rate: ${(passedTests / total * 100).toFixed(1)}%`);

if (failedTests > 0) {
  process.exit(1);
}
