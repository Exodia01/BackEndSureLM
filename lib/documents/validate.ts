/**
 * Validation orchestration.
 *
 * Deterministic rules are authoritative and run first. An AI-assisted pass can
 * escalate borderline outcomes to REVIEW_REQUIRED but can never downgrade a
 * FAIL or PASS to a weaker verdict. Output persists to DocumentValidationReport.
 */
import { db } from "@/lib/db";
import { runDeterministicRules, namesMatch, ageFromDob, type RuleResult } from "@/lib/documents/rules";
import { generateLLMResponse } from "@/lib/ai/agents/llm";
import type { DocumentExtractionRecord } from "@/lib/documents/schemas";

export interface ValidationOutcome {
  status: "PASS" | "FAIL" | "REVIEW_REQUIRED";
  deterministicPass: boolean;
  ruleResults: RuleResult[];
  discrepancies: string[];
  aiAssist: {
    reasoning: string;
    suggestion: string;
  } | null;
}

function toFieldMap(extraction: DocumentExtractionRecord): Record<string, { value: string | null }> {
  return Object.fromEntries(
    Object.entries(extraction.fields).map(([k, v]) => [k, { value: v?.value ?? null }])
  );
}

/** AI-assisted review: never overrides a deterministic verdict. */
async function aiAssistReview(
  docType: string,
  extraction: DocumentExtractionRecord,
  ruleResults: RuleResult[]
): Promise<ValidationOutcome["aiAssist"]> {
  const summary = ruleResults
    .map((r) => `${r.rule}=${r.status}:${r.message}`)
    .join("; ");
  const fields = Object.fromEntries(
    Object.entries(extraction.fields).map(([k, v]) => [
      k,
      { value: v?.value, confidence: v?.confidence, mode: v?.extractionMode },
    ])
  );
  const prompt = `You are reviewing an automated document validation. The deterministic checks produced:
${summary}

Extracted fields:
${JSON.stringify(fields)}

Return STRICT JSON only: {"reasoning": "...", "suggestion": "approve" | "review" | "reject"}
Do not mention specific ID numbers or dates verbatim in your reasoning.`;

  const raw = await generateLLMResponse([{ role: "system", content: prompt }]);
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(stripped);
    const suggestion =
      parsed.suggestion === "approve" || parsed.suggestion === "reject" || parsed.suggestion === "review"
        ? parsed.suggestion
        : "review";
    return {
      reasoning: String(parsed.reasoning ?? "").slice(0, 2000),
      suggestion,
    };
  } catch {
    return null;
  }
}

/**
 * Validate a document extraction and persist a DocumentValidationReport.
 * Deterministic results are authoritative:
 * - deterministic FAIL  → FAIL (terminal; may be re-uploaded); AI can never override
 * - deterministic PASS  → PASS; AI can never downgrade it, even on LLM outage
 * - otherwise (borderline) → REVIEW_REQUIRED, or FAIL if AI advises reject
 */
export async function validateDocument(
  documentId: string,
  extraction: DocumentExtractionRecord
): Promise<ValidationOutcome> {
  const fieldMap = toFieldMap(extraction);
  const { results, pass, fail, review } = runDeterministicRules(extraction.docType, fieldMap);

  const discrepancies: string[] = [];

  // Cross-field name consistency (Aadhaar vs PAN is done at application level).
  const aadhaarName = fieldMap["fullName"]?.value ?? null;
  const panName = fieldMap["fullName"]?.value ?? null;
  if (aadhaarName && panName && !namesMatch(aadhaarName, panName)) {
    discrepancies.push("Name mismatch between documents");
  }

  // Age plausibility against a DOB in the future.
  const dob = fieldMap["dateOfBirth"]?.value ?? null;
  if (dob) {
    const age = ageFromDob(dob);
    if (age !== null && (age < 0 || age > 120)) {
      discrepancies.push("Date of birth yields an implausible age");
    }
  }

  let aiAssist: ValidationOutcome["aiAssist"] = null;

  // AI assist is ADVISORY ONLY. It can escalate borderline outcomes to
  // REVIEW_REQUIRED/FAIL but is never a required gate: a deterministic PASS is
  // authoritative, and an LLM outage (throw/null) must never block a
  // deterministically-validated document from reaching VALIDATED.
  if (!fail) {
    try {
      aiAssist = await aiAssistReview(extraction.docType, extraction, results);
    } catch {
      aiAssist = null;
    }
  }

  let status: ValidationOutcome["status"];
  if (fail) {
    status = "FAIL";
  } else if (pass && discrepancies.length === 0) {
    status = "PASS";
  } else if (aiAssist?.suggestion === "reject") {
    status = "FAIL";
  } else {
    status = "REVIEW_REQUIRED";
  }

  const outcome: ValidationOutcome = {
    status,
    deterministicPass: pass,
    ruleResults: results,
    discrepancies,
    aiAssist,
  };

  await db.documentValidationReport.upsert({
    where: { documentId },
    create: {
      documentId,
      status,
      deterministicPass: pass,
      ruleResults: results as unknown as object,
      discrepancies,
      aiAssist: aiAssist as unknown as object,
      docTypeDetected: extraction.docType,
    },
    update: {
      status,
      deterministicPass: pass,
      ruleResults: results as unknown as object,
      discrepancies,
      aiAssist: aiAssist as unknown as object,
      docTypeDetected: extraction.docType,
    },
  });

  return outcome;
}
