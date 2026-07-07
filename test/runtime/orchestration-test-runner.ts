import "dotenv/config";
import { writeFileSync } from "fs";
import path from "path";

const LOG_DIR = "S:\\BackEndSureLM\\logs\\orchestration-test-2026-07-07";

interface TestResult {
  testName: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

class OrchestrationTestRunner {
  private results: TestResult[] = [];
  private logFile: string;

  constructor() {
    this.logFile = path.join(LOG_DIR, `orchestrator-test-${Date.now()}.json`);
    
    if (!require("fs").existsSync(LOG_DIR)) {
      require("fs").mkdirSync(LOG_DIR, { recursive: true });
    }
    
    console.log("=".repeat(60));
    console.log("Orchestration Test Runner Started");
    console.log(`Log file: ${this.logFile}`);
    console.log("=".repeat(60));
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async run(): Promise<void> {
    this.log("Starting test execution...");
    
    const startTime = Date.now();

    try {
      await this.runUnitTests();
      await this.runIntegrationTests();
      await this.runE2ETests();
    } catch (error) {
      this.log(`Test runner error: ${error instanceof Error ? error.message : String(error)}`);
    }

    const durationMs = Date.now() - startTime;
    
    this.writeSummary(durationMs);
  }

  private async runUnitTests(): Promise<void> {
    this.log("\n--- Unit Tests ---");
    
    const unitTests = [
      { name: "Workflow ID Generation" },
      { name: "Input Validation" },
      { name: "System Prompt Building" },
    ];

    for (const test of unitTests) {
      const result: TestResult = {
        testName: `Unit: ${test.name}`,
        status: "skipped",
        durationMs: 0,
        details: { category: "unit", mocked: true },
      };
      
      this.results.push(result);
      console.log(`  [SKIP] ${test.name}`);
    }
  }

  private async runIntegrationTests(): Promise<void> {
    this.log("\n--- Integration Tests ---");
    
    const checkService = async (name: string, url: string): Promise<boolean> => {
      try {
        const response = await fetch(url);
        return response.ok;
      } catch {
        return false;
      }
    };

    const hasOllama = await checkService("Ollama", process.env.OLLAMA_HOST || "http://localhost:11434");
    this.log(`Ollama available: ${hasOllama}`);
    
    if (!hasOllama) {
      console.log("  [SKIP] Ollama not available - integration tests will be skipped");
    }
    
    const integrationTests = [
      { name: "Full Query Workflow", enabled: hasOllama },
      { name: "Streaming Response", enabled: hasOllama },
      { name: "Empty Results Handling", enabled: true },
      { name: "Multi-Source Retrieval", enabled: true },
    ];

    for (const test of integrationTests) {
      const result: TestResult = {
        testName: `Integration: ${test.name}`,
        status: test.enabled ? "skipped" : "skipped",
        durationMs: 0,
        details: { category: "integration", requiresOllama: !hasOllama },
      };
      
      this.results.push(result);
      
      if (test.enabled) {
        console.log(`  [READY] ${test.name}`);
      } else {
        console.log(`  [SKIP] ${test.name} - service unavailable`);
      }
    }
  }

  private async runE2ETests(): Promise<void> {
    this.log("\n--- E2E Tests ---");
    
    const hasOllama = await checkService("Ollama", process.env.OLLAMA_HOST || "http://localhost:11434");
    
    const e2eTests = [
      { name: "Multi-turn Conversation", enabled: hasOllama },
      { name: "Long Query Handling", enabled: true },
      { name: "Result Deduplication", enabled: true },
    ];

    for (const test of e2eTests) {
      const result: TestResult = {
        testName: `E2E: ${test.name}`,
        status: test.enabled ? "skipped" : "skipped",
        durationMs: 0,
        details: { category: "e2e", requiresOllama: !hasOllama },
      };
      
      this.results.push(result);
      
      if (test.enabled) {
        console.log(`  [READY] ${test.name}`);
      } else {
        console.log(`  [SKIP] ${test.name} - service unavailable`);
      }
    }
  }

  private async checkService(name: string, url: string): Promise<boolean> {
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  private writeSummary(durationMs: number): void {
    const passed = this.results.filter(r => r.status === "passed").length;
    const failed = this.results.filter(r => r.status === "failed").length;
    const skipped = this.results.filter(r => r.status === "skipped").length;

    const summary = {
      timestamp: new Date().toISOString(),
      durationMs,
      totalTests: this.results.length,
      passed,
      failed,
      skipped,
      results: this.results,
    };

    writeFileSync(this.logFile, JSON.stringify(summary, null, 2));

    console.log("\n" + "=".repeat(60));
    console.log("Test Summary");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Duration: ${(durationMs / 1000).toFixed(2)}s`);
    console.log("=".repeat(60));
    console.log(`Detailed log saved to: ${this.logFile}`);
    console.log("=".repeat(60));
  }
}

const runner = new OrchestrationTestRunner();
runner.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

