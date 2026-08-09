/**
 * Document job queue primitives.
 *
 * DocumentJob is a per-document queue row used by the worker. Claiming is
 * ATOMIC: a single PostgreSQL statement using FOR UPDATE SKIP LOCKED guarantees
 * that exactly one worker ever claims a given job, even under concurrency.
 * Retries use exponential backoff; jobs are idempotent: enqueueDocumentJob is
 * a no-op when a pending/running job already exists.
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export const DEFAULT_MAX_ATTEMPTS = 3;

export const LEASE_DURATION_MS = 5 * 60 * 1000;

export function backoffDelayMs(attempt: number, baseMs = 5_000, maxMs = 300_000): number {
  return Math.min(baseMs * 2 ** Math.max(0, attempt - 1), maxMs);
}

export async function enqueueDocumentJob(documentId: string): Promise<{ id: string; status: JobStatus }> {
  const existing = await db.documentJob.findUnique({ where: { documentId } });
  if (existing && existing.status !== "FAILED") {
    return { id: existing.id, status: existing.status };
  }
  const job = await db.documentJob.upsert({
    where: { documentId },
    create: {
      documentId,
      jobType: "DOCUMENT_PROCESSING",
      status: "PENDING",
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      availableAt: new Date(),
    },
    update: {
      status: "PENDING",
      availableAt: new Date(),
      lastError: null,
    },
  });
  return { id: job.id, status: job.status };
}

export interface ClaimedJob {
  id: string;
  documentId: string;
  attempts: number;
  maxAttempts: number;
}

interface ClaimRow {
  id: string;
  documentId: string;
  attempts: number;
  maxAttempts: number;
}

/**
 * Atomically claim the next due job (or reclaim an expired lease).
 *
 * A single FOR UPDATE SKIP LOCKED guarded UPDATE is the claim: two concurrent
 * workers may both evaluate the WHERE clause, but Postgres row locks ensure
 * only ONE of them locks + updates each row, so a job is claimed by exactly one
 * worker. attempts is incremented exactly once per claim (including lease
 * reclaims).
 */
export async function claimNextJob(): Promise<ClaimedJob | null> {
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - LEASE_DURATION_MS);

  const rows = await db.$queryRaw<ClaimRow[]>(Prisma.sql`
    WITH candidate AS (
      SELECT id
      FROM "DocumentJob"
      WHERE ("status" = 'PENDING' AND "availableAt" <= ${now})
         OR ("status" = 'RUNNING' AND "startedAt" <= ${leaseCutoff})
      ORDER BY "availableAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "DocumentJob" AS j
    SET "status" = 'RUNNING',
        "attempts" = j."attempts" + 1,
        "startedAt" = ${now},
        "lastError" = NULL,
        "updatedAt" = ${now}
    FROM candidate
    WHERE j."id" = candidate."id"
    RETURNING j."id", j."documentId", j."attempts", j."maxAttempts";
  `);

  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    documentId: row.documentId,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.maxAttempts),
  };
}

export interface JobCompletion {
  success: boolean;
  error?: string;
  /** If true, the job is retried (attempts remain). */
  retry?: boolean;
}

export async function completeJob(jobId: string, result: JobCompletion): Promise<void> {
  await db.$transaction(async (tx) => {
    const job = await tx.documentJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (result.success) {
      await tx.documentJob.update({
        where: { id: jobId },
        data: { status: "SUCCEEDED", completedAt: new Date() },
      });
      return;
    }
    const shouldRetry = result.retry === true && job.attempts < job.maxAttempts;
    if (shouldRetry) {
      const delayMs = backoffDelayMs(job.attempts);
      await tx.documentJob.update({
        where: { id: jobId },
        data: {
          status: "PENDING",
          availableAt: new Date(Date.now() + delayMs),
          lastError: result.error ?? "retry",
        },
      });
    } else {
      await tx.documentJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          lastError: result.error ?? "failed",
        },
      });
    }
  });
}

/** For tests/CLI: reset a failed job back to pending with a fresh lease. */
export async function requeueFailedJob(jobId: string): Promise<void> {
  await db.documentJob.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      availableAt: new Date(),
      lastError: null,
      startedAt: null,
    },
  });
}
