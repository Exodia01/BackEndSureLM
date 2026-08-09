/**
 * Document type classifier.
 *
 * Deterministic keyword matching first (fast, offline, explainable); the LLM
 * is used only as a fallback for ambiguous inputs. Output is always one of the
 * DocumentType enum values plus a confidence in [0,1].
 */
import { generateLLMResponse } from "@/lib/ai/agents/llm";
import type { DocumentTypeKey } from "@/lib/documents/schemas";

export interface ClassificationResult {
  docType: DocumentTypeKey;
  confidence: number;
  method: "keyword" | "llm";
}

const KEYWORD_RULES: Array<{
  docType: DocumentTypeKey;
  confidence: number;
  patterns: RegExp[];
}> = [
  {
    docType: "AADHAAR",
    confidence: 0.95,
    patterns: [
      /\b\d{4}\s?\d{4}\s?\d{4}\b/,
      /\bAadhaar\b/i,
      /\bUIDAI\b/,
      /\bUnique Identification\b/i,
    ],
  },
  {
    docType: "PAN",
    confidence: 0.95,
    patterns: [
      /\b[A-Z]{5}\d{4}[A-Z]\b/,
      /\bPermanent Account Number\b/i,
      /\bIncome Tax Department\b/i,
    ],
  },
  {
    docType: "BANK_STATEMENT",
    confidence: 0.9,
    patterns: [
      /\bAccount Statement\b/i,
      /\bStatement of Account\b/i,
      /\bAvailable Balance\b/i,
      /\bTransaction Details\b/i,
      /\bIFSC\b/,
    ],
  },
  {
    docType: "INCOME_PROOF",
    confidence: 0.9,
    patterns: [
      /\bSalary Slip\b/i,
      /\bIncome Certificate\b/i,
      /\bForm 16\b/i,
      /\bAnnual Income\b/i,
      /\bGross Salary\b/i,
    ],
  },
  {
    docType: "ADDRESS_PROOF",
    confidence: 0.9,
    patterns: [
      /\bUtility Bill\b/i,
      /\bElectricity Bill\b/i,
      /\bRation Card\b/i,
      /\bRegistered Rent Agreement\b/i,
      /\bAddress Proof\b/i,
    ],
  },
  {
    docType: "POLICY_DOCUMENT",
    confidence: 0.9,
    patterns: [
      /\bPolicy Bond\b/i,
      /\bInsurance Policy\b/i,
      /\bPolicy Number\b/i,
      /\bPolicyholder\b/i,
      /\bSum Assured\b/i,
    ],
  },
  {
    docType: "IDENTITY_PROOF",
    confidence: 0.75,
    patterns: [
      /\bPassport\b/i,
      /\bVoter ID\b/i,
      /\bDriving License\b/i,
      /\bDate of Birth\b/i,
    ],
  },
];

/** Count how many distinct patterns matched for a doc type. */
function score(text: string): Array<{ docType: DocumentTypeKey; score: number; confidence: number }> {
  return KEYWORD_RULES.map((rule) => {
    let score = 0;
    for (const p of rule.patterns) if (p.test(text)) score += 1;
    const confidence = Math.min(rule.confidence, 0.4 + score * 0.2);
    return { docType: rule.docType, score, confidence };
  });
}

export function classifyByKeywords(text: string): ClassificationResult | null {
  const scores = score(text)
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scores.length === 0) return null;
  const best = scores[0];
  if (best.score === 1 && scores[1]?.score === 1 && scores[1].docType === "IDENTITY_PROOF") {
    return { docType: "IDENTITY_PROOF", confidence: 0.5, method: "keyword" };
  }
  return { docType: best.docType, confidence: best.confidence, method: "keyword" };
}

const VALID_TYPES = [
  "AADHAAR",
  "PAN",
  "BANK_STATEMENT",
  "INCOME_PROOF",
  "ADDRESS_PROOF",
  "POLICY_DOCUMENT",
  "IDENTITY_PROOF",
  "OTHER",
] as const;

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

async function classifyByLlm(text: string): Promise<ClassificationResult> {
  const prompt = `Classify this document into exactly one category: AADHAAR, PAN, BANK_STATEMENT, INCOME_PROOF, ADDRESS_PROOF, POLICY_DOCUMENT, IDENTITY_PROOF, OTHER.
Respond with STRICT JSON only: {"docType": "...", "confidence": 0.0 to 1.0}

DOCUMENT TEXT:
${text.slice(0, 4000)}`;

  const raw = await generateLLMResponse([{ role: "system", content: prompt }]);
  const stripped = stripCodeFence(raw);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch {
    throw new Error("Classifier output was not valid JSON");
  }
  const obj = json as { docType?: string; confidence?: number };
  const docType = obj.docType?.toUpperCase();
  if (!docType || !(VALID_TYPES as readonly string[]).includes(docType)) {
    return { docType: "OTHER", confidence: 0.3, method: "llm" };
  }
  const confidence = typeof obj.confidence === "number" ? Math.min(1, Math.max(0, obj.confidence)) : 0.5;
  return { docType: docType as DocumentTypeKey, confidence, method: "llm" };
}

export async function classifyDocument(text: string): Promise<ClassificationResult> {
  const keyword = classifyByKeywords(text);
  if (keyword) return keyword;
  try {
    return await classifyByLlm(text);
  } catch {
    return { docType: "OTHER", confidence: 0.3, method: "llm" };
  }
}

export { VALID_TYPES };
