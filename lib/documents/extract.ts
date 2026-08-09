/**
 * Field extraction from OCR text using the text LLM (generateLLMResponse) with
 * strict Zod validation and provenance tagging (EXPLICIT / INFERRED / UNCERTAIN).
 *
 * The LLM is instructed to only report values present in the text; anything it
 * cannot support must be null. A value of null is never invented.
 */
import { generateLLMResponse } from "@/lib/ai/agents/llm";
import {
  DocumentExtractionSchemas,
  type DocumentTypeKey,
  type DocumentExtractionRecord,
  type ExtractedField,
} from "@/lib/documents/schemas";

export const MAX_EXTRACTION_ATTEMPTS = 3;

export const EXTRACTION_MODEL =
  process.env.EXTRACTION_MODEL || process.env.PRIMARY_MODEL_NAME || "qwen2.5-coder:1.5b";

const JSON_OBJECT_RE = /^\{[\s\S]*\}$/;

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function parseExtractionOutput(raw: string): Record<string, ExtractedField> {
  const stripped = stripCodeFence(raw);
  if (!JSON_OBJECT_RE.test(stripped)) {
    throw new Error("Extraction output was not a JSON object");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error("Extraction output was not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Extraction output must be a flat field object");
  }
  return parsed as Record<string, ExtractedField>;
}

function buildExtractionPrompt(docType: DocumentTypeKey, ocrText: string): string {
  return `You are extracting structured data from OCR text of a ${docType} document.

Rules:
- Only return values that appear in, or are directly derivable from, the OCR text.
- For every field set "value" (null if not present), "confidence" (0..1), and "extractionMode":
  EXPLICIT when the value is printed verbatim; INFERRED when derivable; UNCERTAIN when present but ambiguous.
- NEVER invent or guess a value. Missing data -> "value": null, extractionMode "UNCERTAIN".
- Keep "sourceText" to a short verbatim snippet (max 120 chars) when known.
- Return STRICT JSON only, no markdown, matching exactly this shape:
${Object.keys(DocumentExtractionSchemas[docType].shape).map((f) => `  "${f}": { "value": string|null, "confidence": number, "extractionMode": "EXPLICIT"|"INFERRED"|"UNCERTAIN", "sourceText": string|null }`).join("\n")}

OCR TEXT:
${ocrText.slice(0, 12_000)}`;
}

/**
 * Extract structured fields from OCR text for a document type.
 * Returns a DocumentExtractionRecord on success; throws after MAX attempts.
 */
export async function extractDocumentFields(
  docType: DocumentTypeKey,
  ocrText: string
): Promise<DocumentExtractionRecord> {
  const schema = DocumentExtractionSchemas[docType];
  const prompt = buildExtractionPrompt(docType, ocrText);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS; attempt++) {
    try {
      const raw = await generateLLMResponse(
        [{ role: "system", content: prompt }],
        EXTRACTION_MODEL
      );
      const candidate = parseExtractionOutput(raw);
      const validated = schema.parse(candidate);
      const fields = Object.fromEntries(
        Object.entries(validated).map(([k, v]) => [k, v as ExtractedField])
      );
      return {
        docType,
        fields,
        extractedAt: new Date().toISOString(),
        model: EXTRACTION_MODEL,
      };
    } catch (error) {
      lastError = error;
      // Do not log raw OCR or raw model output — only the failure reason.
      console.warn(`[documents/extract] ${docType} attempt ${attempt}/${MAX_EXTRACTION_ATTEMPTS} failed: ${(error as Error).message}`);
    }
  }

  throw new Error(
    `Field extraction failed after ${MAX_EXTRACTION_ATTEMPTS} attempts: ${(lastError as Error)?.message}`
  );
}

/** Test hook: enforce deterministic zod validation over a raw object. */
export function validateExtractedFields(
  docType: DocumentTypeKey,
  raw: unknown
): Record<string, ExtractedField> {
  const schema = DocumentExtractionSchemas[docType];
  return schema.parse(raw) as Record<string, ExtractedField>;
}
