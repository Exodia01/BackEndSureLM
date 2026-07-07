import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const LOG_DIR = process.env.BATCH_LOG_DIR || "logs/batch-ingest";

/**
 * Ensure log directory exists
 */
export function ensureLogDirectory(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Log progress to file with timestamp
 */
export function logProgress(filename: string, status: "processing" | "success" | "failed", details?: Record<string, unknown>): void {
  ensureLogDirectory();
  
  const timestamp = new Date().toISOString();
  const entry: any = {
    timestamp,
    filename,
    status,
    ...details,
  };
  
  const logFile = join(LOG_DIR, `batch-${new Date().toISOString().split("T")[0]}.log`);
  writeFileSync(logFile, JSON.stringify(entry) + "\n", { flag: "a" });
}
