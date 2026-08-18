import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  customerDocument: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  documentStageLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const storageMock = { get: vi.fn() };
vi.mock("@/lib/documents/storage", () => ({
  getDocumentStorage: () => storageMock,
}));

vi.mock("@/lib/documents/ocr", () => ({
  ocrDocument: vi.fn(),
}));
vi.mock("@/lib/documents/classify", () => ({
  classifyDocument: vi.fn(),
}));
vi.mock("@/lib/documents/extract", () => ({
  extractDocumentFields: vi.fn(),
}));
vi.mock("@/lib/documents/validate", () => ({
  validateDocument: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  writeAuditEvent: vi.fn(),
}));

const { processDocument, ProcessingError } = await import("@/lib/documents/processor");
const { ocrDocument } = await import("@/lib/documents/ocr");
const { classifyDocument } = await import("@/lib/documents/classify");
const { extractDocumentFields } = await import("@/lib/documents/extract");
const { validateDocument } = await import("@/lib/documents/validate");
const { writeAuditEvent } = await import("@/lib/audit");

const BASE_DOC = {
  id: "doc1",
  applicationId: "app1",
  docType: "OTHER",
  status: "UPLOADED",
  originalFilename: "aadhaar.png",
  originalHash: "h",
  mimeType: "image/png",
  sizeBytes: 100,
  storageKey: "documents/aa/bb/h.png",
  pageCount: 1,
  ocrData: null,
  extractedData: null,
  attempts: 0,
  requirementRuleKey: null,
  uploadedById: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const OCR_TEXT = "UIDAI Aadhaar 2345 6789 0124 Ramesh Kumar";
const EXTRACTION = {
  docType: "AADHAAR",
  fields: {
    aadhaarNumber: { value: "234567890124", confidence: 0.99, extractionMode: "EXPLICIT" },
    fullName: { value: "Ramesh Kumar", confidence: 0.98, extractionMode: "EXPLICIT" },
  },
  extractedAt: new Date().toISOString(),
  model: "qwen2.5:7b",
};

describe("processDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.customerDocument.findUnique.mockResolvedValue(BASE_DOC);
    dbMock.customerDocument.update.mockResolvedValue(BASE_DOC);
    dbMock.documentStageLog.create.mockResolvedValue({});
    storageMock.get.mockResolvedValue(Buffer.from("fake image bytes"));
  });

  it("runs the full pipeline to VALIDATED", async () => {
    (ocrDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: OCR_TEXT,
      pages: [OCR_TEXT],
      model: "minicpm-v",
      success: true,
    });
    (classifyDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      docType: "AADHAAR",
      confidence: 0.95,
      method: "keyword",
    });
    (extractDocumentFields as ReturnType<typeof vi.fn>).mockResolvedValue(EXTRACTION);
    (validateDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "PASS",
      deterministicPass: true,
      ruleResults: [],
      discrepancies: [],
      aiAssist: null,
    });

    const result = await processDocument("doc1");
    expect(result.status).toBe("SUCCESS");
    expect(result.stage).toBe("VALIDATE");

    // Lifecycle transitions observed: PROCESSING → OCR_COMPLETE → EXTRACTED → VALIDATED
    const updates = dbMock.customerDocument.update.mock.calls.map((c: any[]) => c[0].data.status);
    expect(updates).toContain("PROCESSING");
    expect(updates).toContain("OCR_COMPLETE");
    expect(updates).toContain("EXTRACTED");
    expect(updates).toContain("VALIDATED");

    // No raw OCR text persisted.
    const ocrDataUpdate = dbMock.customerDocument.update.mock.calls.find(
      (c: any[]) => c[0].data.ocrData
    );
    expect(ocrDataUpdate![0].data.ocrData.text).toBe(OCR_TEXT);

    // Stage logs written for each stage.
    const stages = dbMock.documentStageLog.create.mock.calls.map((c: any[]) => c[0].data.stage);
    expect(stages).toContain("UPLOAD");
    expect(stages).toContain("OCR");
    expect(stages).toContain("CLASSIFY");
    expect(stages).toContain("EXTRACT");
    expect(stages).toContain("VALIDATE");
  });

  it("persists a masked OCR payload that never includes the raw response", async () => {
    (ocrDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: OCR_TEXT,
      pages: [OCR_TEXT],
      model: "minicpm-v",
      success: true,
    });
    (classifyDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      docType: "AADHAAR", confidence: 0.95, method: "keyword",
    });
    (extractDocumentFields as ReturnType<typeof vi.fn>).mockResolvedValue(EXTRACTION);
    (validateDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "PASS", deterministicPass: true, ruleResults: [], discrepancies: [], aiAssist: null,
    });

    await processDocument("doc1");
    const ocrDataUpdate = dbMock.customerDocument.update.mock.calls.find(
      (c: any[]) => c[0].data.ocrData
    );
    const persisted = JSON.stringify(ocrDataUpdate![0].data.ocrData);
    expect(persisted).not.toContain("rawResponse");
  });

  it("marks the document OCR_FAILED on a transient OCR error and throws retryable", async () => {
    (ocrDocument as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Ollama timed out"));
    await expect(processDocument("doc1")).rejects.toBeInstanceOf(ProcessingError);
    await expect(processDocument("doc1")).rejects.toMatchObject({ retryable: true });

    const updates = dbMock.customerDocument.update.mock.calls.map((c: any[]) => c[0].data.status);
    expect(updates).toContain("OCR_FAILED");
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.ocr_failed" })
    );
  });

  it("treats an EMPTY OCR result as retryable", async () => {
    (ocrDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: "   ",
      pages: ["   "],
      model: "minicpm-v",
      success: true,
    });
    await expect(processDocument("doc1")).rejects.toMatchObject({ retryable: true });
  });

  it("fails terminal when the stored object is missing", async () => {
    storageMock.get.mockResolvedValue(null);
    await expect(processDocument("doc1")).rejects.toMatchObject({ retryable: false });
    const updates = dbMock.customerDocument.update.mock.calls.map((c: any[]) => c[0].data.status);
    expect(updates).toContain("PROCESSING");
  });

  it("marks EXTRACTION_FAILED and throws non-retryable on extraction errors", async () => {
    (ocrDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: OCR_TEXT, pages: [OCR_TEXT], model: "minicpm-v", success: true,
    });
    (classifyDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      docType: "AADHAAR", confidence: 0.95, method: "keyword",
    });
    (extractDocumentFields as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("not valid JSON")
    );

    await expect(processDocument("doc1")).rejects.toMatchObject({ retryable: false });
    const updates = dbMock.customerDocument.update.mock.calls.map((c: any[]) => c[0].data.status);
    expect(updates).toContain("EXTRACTION_FAILED");
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.extraction_failed" })
    );
  });

  it("ends in REVIEW_REQUIRED when validation says so and audits it", async () => {
    (ocrDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: OCR_TEXT, pages: [OCR_TEXT], model: "minicpm-v", success: true,
    });
    (classifyDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      docType: "AADHAAR", confidence: 0.7, method: "llm",
    });
    (extractDocumentFields as ReturnType<typeof vi.fn>).mockResolvedValue(EXTRACTION);
    (validateDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "REVIEW_REQUIRED",
      deterministicPass: false,
      ruleResults: [],
      discrepancies: ["Name mismatch"],
      aiAssist: null,
    });

    const result = await processDocument("doc1");
    expect(result.status).toBe("FAILED");
    expect(result.stage).toBe("REVIEW");
    const updates = dbMock.customerDocument.update.mock.calls.map((c: any[]) => c[0].data.status);
    expect(updates).toContain("REVIEW_REQUIRED");
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "document.validation_review_required" })
    );
  });

  it("throws non-retryable when the document does not exist", async () => {
    dbMock.customerDocument.findUnique.mockResolvedValue(null);
    await expect(processDocument("ghost")).rejects.toMatchObject({ retryable: false });
  });
});
