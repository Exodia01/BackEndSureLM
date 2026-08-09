/**
 * Document processing pipeline (worker side).
 *
 * One document goes through: OCR → CLASSIFY → EXTRACT → VALIDATE. Each stage
 * writes a DocumentStageLog row and updates the CustomerDocument.status so the
 * outer lifecycle is always observable:
 *
 *   UPLOADED → PROCESSING → OCR_COMPLETE → EXTRACTED → VALIDATED
 *                            ↘ OCR_FAILED        ↘ EXTRACTION_FAILED
 *                                                ↘ VALIDATION_FAILED
 *                                                ↘ REVIEW_REQUIRED
 *
 * Failures that look transient (timeout, model down) are retried via the job
 * queue with backoff; deterministic failures are terminal.
 */
import { db } from "@/lib/db";
import { getDocumentStorage } from "@/lib/documents/storage";
import { ocrDocument } from "@/lib/documents/ocr";
import { classifyDocument } from "@/lib/documents/classify";
import { extractDocumentFields } from "@/lib/documents/extract";
import { validateDocument } from "@/lib/documents/validate";
import { writeAuditEvent } from "@/lib/audit";

type Stage = "UPLOAD" | "NORMALIZE" | "OCR" | "CLASSIFY" | "EXTRACT" | "VALIDATE" | "REVIEW";

async function logStage(documentId: string, stage: Stage, data: {
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  attempts?: number;
  model?: string;
  confidence?: number;
  errorCode?: string;
  message?: string;
  metadata?: object;
}) {
  await db.documentStageLog.create({
    data: {
      documentId,
      stage,
      status: data.status,
      attempts: data.attempts ?? 1,
      model: data.model ?? null,
      confidence: data.confidence ?? null,
      errorCode: data.errorCode ?? null,
      message: data.message ?? null,
      metadata: data.metadata ? (data.metadata as object) : undefined,
    },
  });
}

export class ProcessingError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof ProcessingError) return error.retryable;
  const msg = (error as Error)?.message ?? "";
  return /timed out|ECONNREFUSED|failed to fetch|ollama/i.test(msg);
}

/**
 * Run the full pipeline for one document. Returns a summary. Does NOT touch
 * the DocumentJob row — callers handle success/failure/retry accounting.
 */
export async function processDocument(documentId: string): Promise<{
  documentId: string;
  stage: Stage;
  status: "SUCCESS" | "FAILED";
  message: string;
}> {
  const document = await db.customerDocument.findUnique({ where: { id: documentId } });
  if (!document) throw new ProcessingError("Document not found", false);

  // Lifecycle: PROCESSING
  await db.customerDocument.update({
    where: { id: documentId },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  await logStage(documentId, "UPLOAD", { status: "SUCCESS", message: "Document acknowledged" });

  // ── OCR ───────────────────────────────────────────────────────────────────
  const storage = getDocumentStorage();
  const buffer = await storage.get(document.storageKey);
  if (!buffer) {
    await logStage(documentId, "OCR", { status: "FAILED", errorCode: "STORAGE_MISSING", message: "Stored object not found" });
    throw new ProcessingError("Stored object missing", false);
  }
  if (buffer.length > 10 * 1024 * 1024) {
    await logStage(documentId, "OCR", { status: "FAILED", errorCode: "TOO_LARGE", message: "File exceeds size limit" });
    throw new ProcessingError("File exceeds size limit", false);
  }

  await logStage(documentId, "OCR", { status: "RUNNING", model: process.env.VISION_MODEL || "minicpm-v" });
  let ocrText: string;
  let ocrModel: string;
  try {
    const result = await ocrDocument(buffer, document.mimeType);
    ocrText = result.text;
    ocrModel = result.model;
    if (!ocrText.trim()) {
      await logStage(documentId, "OCR", { status: "FAILED", errorCode: "EMPTY", message: "OCR returned no text" });
      throw new ProcessingError("OCR returned no text", true);
    }
  } catch (error) {
    const retryable = isRetryable(error);
    await logStage(documentId, "OCR", {
      status: "FAILED",
      model: process.env.VISION_MODEL || "minicpm-v",
      errorCode: retryable ? "OCR_TRANSIENT" : "OCR_FATAL",
      message: (error as Error).message.slice(0, 500),
    });
    await db.customerDocument.update({
      where: { id: documentId },
      data: { status: "OCR_FAILED" },
    });
    await writeAuditEvent({
      actorId: "system",
      actorRole: "system",
      action: "document.ocr_failed",
      entityType: "CustomerDocument",
      entityId: documentId,
      metadata: { errorCode: retryable ? "OCR_TRANSIENT" : "OCR_FATAL" },
    });
    throw new ProcessingError("OCR failed: " + (error as Error).message, retryable);
  }

  // OCR succeeded: persist ocrData (masked, no raw response retained).
  await db.customerDocument.update({
    where: { id: documentId },
    data: {
      status: "OCR_COMPLETE",
      ocrData: { text: ocrText, model: ocrModel, ocrAt: new Date().toISOString() } as object,
      pageCount: ocrText.length > 0 ? document.pageCount ?? undefined : undefined,
    },
  });
  await logStage(documentId, "OCR", { status: "SUCCESS", model: ocrModel, message: "OCR complete" });

  // ── CLASSIFY ──────────────────────────────────────────────────────────────
  await logStage(documentId, "CLASSIFY", { status: "RUNNING" });
  const classified = await classifyDocument(ocrText);
  await logStage(documentId, "CLASSIFY", {
    status: "SUCCESS",
    confidence: classified.confidence,
    metadata: { docType: classified.docType, method: classified.method },
  });

  // ── EXTRACT ───────────────────────────────────────────────────────────────
  await logStage(documentId, "EXTRACT", { status: "RUNNING" });
  let extraction;
  try {
    extraction = await extractDocumentFields(classified.docType, ocrText);
  } catch (error) {
    await logStage(documentId, "EXTRACT", { status: "FAILED", errorCode: "EXTRACT_FAILED", message: (error as Error).message.slice(0, 500) });
    await db.customerDocument.update({
      where: { id: documentId },
      data: { status: "EXTRACTION_FAILED" },
    });
    await writeAuditEvent({
      actorId: "system",
      actorRole: "system",
      action: "document.extraction_failed",
      entityType: "CustomerDocument",
      entityId: documentId,
    });
    throw new ProcessingError("Extraction failed: " + (error as Error).message, false);
  }

  await db.customerDocument.update({
    where: { id: documentId },
    data: {
      status: "EXTRACTED",
      docType: classified.docType,
      extractedData: extraction as object,
    },
  });
  await logStage(documentId, "EXTRACT", { status: "SUCCESS", model: extraction.model });

  // ── VALIDATE ──────────────────────────────────────────────────────────────
  await logStage(documentId, "VALIDATE", { status: "RUNNING" });
  const outcome = await validateDocument(documentId, extraction);

  let finalStatus: string;
  switch (outcome.status) {
    case "PASS":
      finalStatus = "VALIDATED";
      break;
    case "FAIL":
      finalStatus = "VALIDATION_FAILED";
      break;
    case "REVIEW_REQUIRED":
      finalStatus = "REVIEW_REQUIRED";
      break;
  }

  await db.customerDocument.update({
    where: { id: documentId },
    data: { status: finalStatus as "VALIDATED" | "VALIDATION_FAILED" | "REVIEW_REQUIRED" },
  });
  await logStage(documentId, "VALIDATE", {
    status: "SUCCESS",
    confidence: outcome.deterministicPass ? 1 : undefined,
    metadata: { verdict: outcome.status, deterministicPass: outcome.deterministicPass },
  });

  if (outcome.status === "REVIEW_REQUIRED") {
    await writeAuditEvent({
      actorId: "system",
      actorRole: "system",
      action: "document.validation_review_required",
      entityType: "CustomerDocument",
      entityId: documentId,
      metadata: { discrepancies: outcome.discrepancies },
    });
  }

  return {
    documentId,
    stage: outcome.status === "REVIEW_REQUIRED" ? "REVIEW" : "VALIDATE",
    status: outcome.status === "PASS" ? "SUCCESS" : "FAILED",
    message: `Validation verdict: ${outcome.status}`,
  };
}
