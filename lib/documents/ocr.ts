/**
 * Multimodal OCR via Ollama vision models (ChatOllama).
 *
 * Design constraints (Phase 4B):
 *   - VISION_MODEL is primary, VISION_FALLBACK is secondary.
 *   - PDFs are rasterized page-by-page with pdfjs + @napi-rs/canvas before OCR.
 *   - A hard timeout aborts the model call so a hung Ollama cannot wedge the
 *     worker; the caller retries with backoff.
 *   - NEVER log the raw model response (contains PII). Only log status/model.
 */
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface OCRResult {
  /** Concatenated text of all pages/images. Empty string when no text found. */
  text: string;
  /** Per-page text so downstream code can cite source pages. */
  pages: string[];
  model: string;
  success: boolean;
}

export interface OCRConfig {
  /** Max bytes accepted for a single file. */
  maxSizeBytes: number;
  /** Max pages to rasterize/OCR from a PDF. */
  maxPages: number;
  /** Per-page OCR timeout in ms. */
  timeoutMs: number;
}

export const DEFAULT_OCR_CONFIG: OCRConfig = {
  maxSizeBytes: 10 * 1024 * 1024,
  maxPages: 25,
  timeoutMs: 90_000,
};

export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getOllamaHost(): string {
  return process.env.OLLAMA_HOST || "http://localhost:11434";
}

function getVisionModel(): { primary: string; fallback: string } {
  return {
    primary: process.env.VISION_MODEL || "minicpm-v",
    fallback: process.env.VISION_FALLBACK || "llava:7b",
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`OCR timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

import { detectMimeType } from "./mime";

/**
 * Rasterize a PDF page to a PNG buffer using pdfjs + @napi-rs/canvas.
 * The page renders at 2x for better OCR accuracy.
 */
export async function rasterizePdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale = 2
): Promise<Buffer> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  // pdfjs 5.x derives the canvas element from the context at runtime; the type
  // still demands the canvas property, so cast the napi-rs canvas into it.
  await page
    .render({
      canvasContext: ctx,
      viewport,
      canvas: canvas as unknown as HTMLCanvasElement,
    })
    .promise;
  const png = canvas.toBuffer("image/png");
  await page.cleanup();
  return png;
}

let pdfjsWorkerReady = false;
function ensurePdfjsWorker(): void {
  if (pdfjsWorkerReady) return;
  // Resolve the worker through Node's module resolution so it works from both
  // Next.js and the standalone tsx worker (import.meta.resolve → file:// URL).
  const workerSrc = (import.meta as unknown as { resolve?: (spec: string) => string }).resolve
    ? (import.meta as unknown as { resolve: (spec: string) => string }).resolve(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs"
      )
    : new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  pdfjsWorkerReady = true;
}

async function loadPdf(buffer: Buffer): Promise<PDFDocumentProxy> {
  ensurePdfjsWorker();
  const task = pdfjs.getDocument({ data: buffer });
  return task.promise;
}

/**
 * OCR a single image (PNG/JPEG/WEBP) with the given model.
 * Never logs the response content.
 */
async function ocrImageWithModel(
  imageBase64: string,
  model: string,
  prompt: string,
  timeoutMs: number
): Promise<string> {
  const modelCall = new ChatOllama({
    baseUrl: getOllamaHost(),
    model,
    temperature: 0.1,
  });

  const message = new HumanMessage({
    content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
    ],
  });

  const response = await withTimeout(modelCall.invoke([message]), timeoutMs);
  const content = typeof response.content === "string" ? response.content : "";
  return content.trim();
}

/**
 * OCR a single rasterized image, trying primary then fallback model.
 * Returns the best non-empty result.
 */
async function ocrImage(buffer: Buffer, timeoutMs: number): Promise<{ text: string; model: string }> {
  const { primary, fallback } = getVisionModel();
  const imageBase64 = buffer.toString("base64");
  const prompt =
    "Extract ALL visible text from this document image verbatim. " +
    "Preserve spacing and line breaks where meaningful. " +
    "Include numbers, names, and dates exactly as printed. " +
    "Do not summarize, interpret, or add commentary. " +
    "If the image contains no readable text, reply with exactly the word EMPTY.";

  const attempts: Array<[string, string]> = [[primary, primary]];
  if (fallback && fallback !== primary) attempts.push([fallback, fallback]);

  let lastError: Error | null = null;
  for (const [model] of attempts) {
    try {
      const text = await ocrImageWithModel(imageBase64, model, prompt, timeoutMs);
      if (text && text !== "EMPTY") return { text, model };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  if (lastError) throw lastError;
  return { text: "", model: primary };
}

/**
 * OCR an uploaded file (PDF or image). For PDFs, rasterizes up to maxPages
 * pages and concatenates the per-page text.
 */
export async function ocrDocument(buffer: Buffer, mimeType: string | null): Promise<OCRResult> {
  const actualMime = mimeType ?? detectMimeType(buffer);
  const config = DEFAULT_OCR_CONFIG;

  if (buffer.length > config.maxSizeBytes) {
    throw new Error(`File exceeds maximum size of ${config.maxSizeBytes / (1024 * 1024)}MB`);
  }

  if (actualMime === "application/pdf") {
    const pdf = await loadPdf(buffer);
    try {
      const pageCount = pdf.numPages;
      const pagesToOcr = Math.min(pageCount, config.maxPages);
      const pages: string[] = [];
      let modelUsed = "unknown";
      for (let i = 1; i <= pagesToOcr; i++) {
        const png = await rasterizePdfPage(pdf, i);
        const { text, model } = await ocrImage(png, config.timeoutMs);
        modelUsed = model;
        pages.push(`[Page ${i}]\n${text}`);
      }
      return {
        text: pages.join("\n\n").trim(),
        pages,
        model: modelUsed,
        success: true,
      };
    } finally {
      await pdf.destroy().catch(() => {});
    }
  }

  if (actualMime && ALLOWED_IMAGE_MIME_TYPES.has(actualMime)) {
    const { text, model } = await ocrImage(buffer, config.timeoutMs);
    return { text, pages: [text], model, success: true };
  }

  throw new Error(`Unsupported document type: ${actualMime ?? "unknown"}`);
}
