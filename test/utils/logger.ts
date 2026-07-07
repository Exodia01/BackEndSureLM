import fs from "fs";
import path from "path";

const LOG_DIR = "S:\\BackEndSureLM\\logs\\orchestration-test-2026-07-07";

export class TestLogger {
  private static instance: TestLogger;
  private logFile: string;

  private constructor() {
    this.logFile = path.join(LOG_DIR, `orchestrator-test-${Date.now()}.log`);
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  static getInstance(): TestLogger {
    if (!TestLogger.instance) {
      TestLogger.instance = new TestLogger();
    }
    return TestLogger.instance;
  }

  log(message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;
    
    fs.appendFileSync(this.logFile, `${formattedMessage}\n`);
    
    if (data !== undefined) {
      fs.appendFileSync(this.logFile, JSON.stringify(data, null, 2));
      fs.appendFileSync(this.logFile, "\n");
    }
    
    console.log(formattedMessage);
    if (data !== undefined) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  logTestStart(testName: string): void {
    this.log("=" .repeat(60), undefined);
    this.log(`TEST STARTED: ${testName}`, undefined);
    this.log("=" .repeat(60), undefined);
  }

  logAgentCall(agent: string, input: unknown, output?: unknown): void {
    this.log(`[AGENT] ${agent} called`, { input });
    if (output) {
      this.log(`[AGENT] ${agent} result`, { output });
    }
  }

  logTestEnd(testName: string, passed: boolean, durationMs: number): void {
    this.log("=" .repeat(60), undefined);
    this.log(`TEST ENDED: ${testName}`, { 
      status: passed ? "PASSED" : "FAILED", 
      duration_ms: durationMs 
    });
    this.log("=" .repeat(60), undefined);
  }

  logError(error: Error): void {
    this.log("[ERROR]", {
      message: error.message,
      stack: error.stack,
    });
  }
}

export const logger = TestLogger.getInstance();

