/**
 * Document processing worker. Polls the DocumentJob queue and runs one
 * document at a time through the pipeline (OCR → classify → extract →
 * validate). Retries with backoff happen automatically via the job queue.
 *
 * Run with: npm run worker:documents
 *   WORKER_POLL_MS=3000 (default) controls the poll interval.
 */
import "dotenv/config";
import { claimNextJob, completeJob } from "@/lib/documents/jobs";
import { processDocument } from "@/lib/documents/processor";
import { writeAuditEvent } from "@/lib/audit";

const POLL_MS = Number(process.env.WORKER_POLL_MS || 3000);

async function runOnce(): Promise<void> {
  const job = await claimNextJob();
  if (!job) return;

  console.log(`[worker] claimed job ${job.id} document=${job.documentId} attempt=${job.attempts}`);
  try {
    const result = await processDocument(job.documentId);
    await completeJob(job.id, { success: true });
    console.log(`[worker] done job=${job.id} verdict=${result.message}`);
    await writeAuditEvent({
      actorId: "system",
      actorRole: "system",
      action: "document.job_completed",
      entityType: "DocumentJob",
      entityId: job.id,
      metadata: { documentId: job.documentId },
    });
  } catch (error) {
    const message = (error as Error).message;
    const retryable = /timed out|ECONNREFUSED|ollama|failed to fetch/i.test(message);
    console.error(`[worker] job ${job.id} failed (retry=${retryable}):`, message);
    await completeJob(job.id, { success: false, error: message.slice(0, 1000), retry: retryable });
    await writeAuditEvent({
      actorId: "system",
      actorRole: "system",
      action: "document.job_started",
      entityType: "DocumentJob",
      entityId: job.id,
      metadata: { documentId: job.documentId, error: message.slice(0, 500), retryable },
    });
  }
}

async function main(): Promise<void> {
  console.log(`[worker] starting; poll=${POLL_MS}ms`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runOnce();
    } catch (error) {
      console.error("[worker] unexpected error:", (error as Error).message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
