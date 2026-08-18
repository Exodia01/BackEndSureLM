import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  documentJob: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const {
  backoffDelayMs,
  enqueueDocumentJob,
  claimNextJob,
  completeJob,
  requeueFailedJob,
} = await import("@/lib/documents/jobs");

describe("backoffDelayMs", () => {
  it("exponentially backs off and caps at the max", () => {
    expect(backoffDelayMs(1)).toBe(5000);
    expect(backoffDelayMs(2)).toBe(10000);
    expect(backoffDelayMs(3)).toBe(20000);
    expect(backoffDelayMs(7)).toBe(300000);
  });
});

describe("enqueueDocumentJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is a no-op when a pending job already exists", async () => {
    dbMock.documentJob.findUnique.mockResolvedValue({ id: "j1", status: "PENDING" });
    const r = await enqueueDocumentJob("d1");
    expect(r).toEqual({ id: "j1", status: "PENDING" });
    expect(dbMock.documentJob.upsert).not.toHaveBeenCalled();
  });

  it("re-queues when the existing job is FAILED", async () => {
    dbMock.documentJob.findUnique.mockResolvedValue({ id: "j1", status: "FAILED" });
    dbMock.documentJob.upsert.mockResolvedValue({ id: "j2", status: "PENDING" });
    const r = await enqueueDocumentJob("d1");
    expect(r.status).toBe("PENDING");
    expect(dbMock.documentJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentId: "d1" },
        create: expect.objectContaining({ status: "PENDING", maxAttempts: 3 }),
      })
    );
  });
});

describe("claimNextJob", () => {
  beforeEach(() => vi.clearAllMocks());

  it("claims a due job via the atomic FOR UPDATE SKIP LOCKED claim", async () => {
    dbMock.$queryRaw.mockResolvedValue([
      { id: "j1", documentId: "d1", attempts: 2, maxAttempts: 3 },
    ]);

    const job = await claimNextJob();
    expect(job).toEqual({ id: "j1", documentId: "d1", attempts: 2, maxAttempts: 3 });
    expect(dbMock.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = dbMock.$queryRaw.mock.calls[0][0];
    expect(sql.text).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("handles BigInt attempts from the DB driver", async () => {
    dbMock.$queryRaw.mockResolvedValue([
      { id: "j1", documentId: "d1", attempts: BigInt(2), maxAttempts: BigInt(3) },
    ]);
    const job = await claimNextJob();
    expect(job).toEqual({ id: "j1", documentId: "d1", attempts: 2, maxAttempts: 3 });
  });

  it("returns null when no job is due", async () => {
    dbMock.$queryRaw.mockResolvedValue([]);
    expect(await claimNextJob()).toBeNull();
  });
});

describe("completeJob", () => {
  beforeEach(() => vi.clearAllMocks());

  const txRun = (fn: (tx: any) => Promise<any>) => fn(dbMock);

  it("marks success as SUCCEEDED", async () => {
    dbMock.$transaction.mockImplementation(txRun);
    dbMock.documentJob.findUnique.mockResolvedValue({ id: "j1", attempts: 1, maxAttempts: 3 });
    await completeJob("j1", { success: true });
    expect(dbMock.documentJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUCCEEDED" }) })
    );
  });

  it("requeues with backoff when retryable and attempts remain", async () => {
    dbMock.$transaction.mockImplementation(txRun);
    dbMock.documentJob.findUnique.mockResolvedValue({ id: "j1", attempts: 1, maxAttempts: 3 });
    await completeJob("j1", { success: false, error: "ollama down", retry: true });
    expect(dbMock.documentJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", lastError: "ollama down" }),
      })
    );
  });

  it("fails terminal when attempts are exhausted", async () => {
    dbMock.$transaction.mockImplementation(txRun);
    dbMock.documentJob.findUnique.mockResolvedValue({ id: "j1", attempts: 3, maxAttempts: 3 });
    await completeJob("j1", { success: false, error: "bad file", retry: true });
    expect(dbMock.documentJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
  });

  it("fails terminal for non-retryable errors even with attempts left", async () => {
    dbMock.$transaction.mockImplementation(txRun);
    dbMock.documentJob.findUnique.mockResolvedValue({ id: "j1", attempts: 1, maxAttempts: 3 });
    await completeJob("j1", { success: false, error: "corrupt pdf" });
    expect(dbMock.documentJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
  });
});

describe("requeueFailedJob", () => {
  it("resets a failed job to PENDING with a fresh lease", async () => {
    dbMock.documentJob.update.mockResolvedValue({});
    await requeueFailedJob("j1");
    expect(dbMock.documentJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", startedAt: null }),
      })
    );
  });
});
