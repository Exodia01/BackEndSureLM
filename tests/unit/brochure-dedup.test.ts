import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  brochure: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  chunk: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  brochureLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const fsMock = {
  mkdir: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
};

vi.mock("fs/promises", () => ({ default: fsMock }));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

vi.mock("@/lib/qdrant", () => ({
  upsert: vi.fn().mockResolvedValue(undefined),
  createCollection: vi.fn().mockResolvedValue(undefined),
}));

const { uploadBrochure, computeFileHash } = await import("@/lib/pdf/batchProcess");

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]).buffer as ArrayBuffer;

describe("brochure dedup and versioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PDF_STORAGE_DIR = "/tmp/test-pdfs";
    fsMock.access.mockRejectedValue(new Error("ENOENT"));
  });

  it("rejects non-PDF files", async () => {
    await expect(uploadBrochure(PDF_BYTES, "brochure.txt", 100)).rejects.toThrow(
      "Only PDF files are allowed"
    );
  });

  it("rejects oversized files", async () => {
    await expect(uploadBrochure(PDF_BYTES, "brochure.pdf", 51 * 1024 * 1024)).rejects.toThrow(
      "exceeds maximum size"
    );
  });

  it("returns existing brochure for duplicate content without creating a new row", async () => {
    dbMock.brochure.findFirst.mockResolvedValue({
      id: "existing-id",
      versionNum: 2,
      versionHash: computeFileHash(PDF_BYTES),
    });

    const result = await uploadBrochure(PDF_BYTES, "kotak_premier_life.pdf", 100);

    expect(result.brochureId).toBe("existing-id");
    expect(result.status).toBe("NEW");
    expect(result.message).toContain("Duplicate");
    expect(dbMock.brochure.create).not.toHaveBeenCalled();
    expect(dbMock.brochure.update).not.toHaveBeenCalled();
  });

  it("creates a new brochure (version 1) with a filePath on first upload", async () => {
    dbMock.brochure.findFirst.mockResolvedValueOnce(null); // no duplicate
    dbMock.brochure.findFirst.mockResolvedValueOnce(null); // no previous version
    dbMock.brochure.create.mockResolvedValue({ id: "new-id" });

    const result = await uploadBrochure(PDF_BYTES, "kotak_premier_life.pdf", 100);

    expect(result.status).toBe("NEW");
    expect(result.brochureId).toBe("new-id");
    expect(dbMock.brochure.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNum: 1,
          status: "PROCESSING",
          filePath: expect.stringMatching(/\.pdf$/),
        }),
      })
    );
    // pdfData (BYTEA) must no longer be written.
    const createData = (dbMock.brochure.create.mock.calls[0][0] as any).data;
    expect(createData).not.toHaveProperty("pdfData");
    expect(fsMock.writeFile).toHaveBeenCalled();
  });

  it("creates a new version and archives older rows on content change", async () => {
    dbMock.brochure.findFirst
      .mockResolvedValueOnce(null) // no duplicate
      .mockResolvedValueOnce({ id: "v1-id", versionNum: 1 }); // previous version exists
    dbMock.brochure.update.mockResolvedValue({});
    dbMock.brochure.updateMany.mockResolvedValue({});
    dbMock.brochureLog.create.mockResolvedValue({});

    const result = await uploadBrochure(PDF_BYTES, "kotak_premier_life.pdf", 100);

    expect(result.status).toBe("VERSION");
    expect(dbMock.brochure.updateMany).toHaveBeenCalledWith({
      where: { basename: "kotak_premier_life", id: { not: "v1-id" } },
      data: { status: "ARCHIVED" },
    });
    expect(dbMock.brochure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "v1-id" },
        data: expect.objectContaining({ versionNum: 2, status: "PROCESSING" }),
      })
    );
    expect(dbMock.brochureLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "VERSION_CREATED" }) })
    );
  });

  it("writes PDF to disk without overwriting existing files", async () => {
    dbMock.brochure.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    dbMock.brochure.create.mockResolvedValue({ id: "new-id" });

    // First access attempt fails (ENOENT), file gets written.
    fsMock.access.mockRejectedValueOnce(new Error("ENOENT"));
    await uploadBrochure(PDF_BYTES, "a.pdf", 100);
    expect(fsMock.writeFile).toHaveBeenCalledTimes(1);

    // Second upload where file already exists: no second write.
    vi.clearAllMocks();
    dbMock.brochure.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    dbMock.brochure.create.mockResolvedValue({ id: "new-id2" });
    fsMock.access.mockResolvedValueOnce(undefined);
    await uploadBrochure(PDF_BYTES, "a.pdf", 100);
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });
});
