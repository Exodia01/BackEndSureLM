/**
 * Deterministic application checklist evaluation.
 *
 * The checklist is evaluated EXCLUSIVELY against the application's frozen
 * RequirementSnapshot (captured at policy-version publish time). Current/latest
 * policy requirements never participate: the frozen snapshot is authoritative.
 *
 * Semantics (Phase 4C):
 *  - A requirement is SATISFIED only when a VALIDATED document whose
 *    validation report is PASS exists for the requirement (either bound
 *    explicitly via `requirementRuleKey`, or by matching the requirement's
 *    resolved evidence doc type).
 *  - A VALIDATED document is EVIDENCE for a requirement; it never implies
 *    suitability by itself.
 *  - Any REVIEW_REQUIRED document blocks automatic approval.
 *  - Any failed/rejected document blocks approval.
 *  - Requirements that cannot be mapped to an evidence document type are
 *    treated as UNSATISFIED (fail closed): approval is impossible until the
 *    policy author exposes evidence that can be verified deterministically.
 */
import type { DocumentTypeKey } from "@/lib/documents/schemas";

export interface FrozenRequirement {
  id?: string | null;
  ruleKey: string;
  label: string;
  description?: string | null;
  confidence?: number | null;
  extractionMode?: string | null;
  validationRules?: Record<string, unknown> | null;
  sourceChunkIds?: string[] | null;
}

/** Minimal view of a document + its validation outcome, as used by the checklist. */
export interface EvidenceDocumentView {
  id: string;
  docType: string;
  status: string;
  requirementRuleKey: string | null;
  validationStatus: string | null;
  deterministicPass: boolean | null;
}

export interface ChecklistRequirementResult {
  ruleKey: string;
  label: string;
  evidenceDocType: DocumentTypeKey | null;
  satisfied: boolean;
  evidenceDocumentId: string | null;
  reason: string;
}

export interface ChecklistEvaluation {
  requirements: ChecklistRequirementResult[];
  /** True when EVERY frozen requirement is satisfied. */
  satisfied: boolean;
  /** True when any document is in REVIEW_REQUIRED (blocks approval). */
  hasReviewRequired: boolean;
  /** True when any document failed validation / was rejected. */
  hasFailedDocuments: boolean;
  hasDocuments: boolean;
  /** Deterministic gate: satisfied AND nothing blocked. */
  canApprove: boolean;
  blockers: string[];
}

/**
 * Deterministic ruleKey → evidence doc type mapping (code-level, documented).
 *
 * Order matters: more specific keys must be matched before generic ones
 * (e.g. "KYC_PAN" must resolve to PAN before the generic KYC/identity rule).
 */
const RULE_TO_DOCTYPE: Array<{ re: RegExp; docType: DocumentTypeKey }> = [
  { re: /pan/i, docType: "PAN" },
  { re: /aadhaar|aadhar|uidai/i, docType: "AADHAAR" },
  { re: /bank|statement|ifsc/i, docType: "BANK_STATEMENT" },
  { re: /income|salary|itr|form\s*16/i, docType: "INCOME_PROOF" },
  { re: /address|residence|utility/i, docType: "ADDRESS_PROOF" },
  { re: /identity|id\s*proof|kyc/i, docType: "IDENTITY_PROOF" },
  { re: /policy|bond/i, docType: "POLICY_DOCUMENT" },
];

/** Resolve the document type that can evidence a frozen requirement. */
export function resolveEvidenceDocType(ruleKey: string): DocumentTypeKey | null {
  if (!ruleKey) return null;
  for (const { re, docType } of RULE_TO_DOCTYPE) {
    if (re.test(ruleKey)) return docType;
  }
  return null;
}

const TERMINAL_FAILED_DOC_STATUSES = ["REJECTED", "VALIDATION_FAILED", "OCR_FAILED", "EXTRACTION_FAILED"];

export function evaluateChecklist(
  requirements: FrozenRequirement[],
  documents: EvidenceDocumentView[]
): ChecklistEvaluation {
  const validatedPassing = documents.filter(
    (d) => d.status === "VALIDATED" && d.validationStatus === "PASS"
  );
  const reviewRequired = documents.filter((d) => d.status === "REVIEW_REQUIRED");
  const failed = documents.filter((d) => TERMINAL_FAILED_DOC_STATUSES.includes(d.status));
  const hasReviewRequired = reviewRequired.length > 0;
  const hasFailedDocuments = failed.length > 0;
  const hasDocuments = documents.length > 0;

  const reqResults: ChecklistRequirementResult[] = requirements.map((req) => {
    const evidenceDocType = resolveEvidenceDocType(req.ruleKey);
    const evidence =
      evidenceDocType === null
        ? null
        : validatedPassing.find(
            (d) =>
              (d.requirementRuleKey !== null && d.requirementRuleKey === req.ruleKey) ||
              d.docType === evidenceDocType
          ) ?? null;

    if (evidenceDocType === null) {
      return {
        ruleKey: req.ruleKey,
        label: req.label,
        evidenceDocType: null,
        satisfied: false,
        evidenceDocumentId: null,
        reason: "Requirement has no mapped evidence document type; cannot be confirmed deterministically",
      };
    }
    if (evidence) {
      return {
        ruleKey: req.ruleKey,
        label: req.label,
        evidenceDocType,
        satisfied: true,
        evidenceDocumentId: evidence.id,
        reason: `Evidence: VALIDATED ${evidence.docType} (${evidence.id})`,
      };
    }
    return {
      ruleKey: req.ruleKey,
      label: req.label,
      evidenceDocType,
      satisfied: false,
      evidenceDocumentId: null,
      reason: `Missing validated ${evidenceDocType} evidence`,
    };
  });

  const satisfied = requirements.length > 0 && reqResults.every((r) => r.satisfied);

  const blockers: string[] = [];
  if (requirements.length === 0) blockers.push("Frozen requirement snapshot is empty");
  for (const r of reqResults) {
    if (!r.satisfied) blockers.push(`Requirement ${r.ruleKey} (${r.label}): ${r.reason}`);
  }
  if (hasReviewRequired) {
    blockers.push(`${reviewRequired.length} document(s) await manual review (REVIEW_REQUIRED)`);
  }
  if (hasFailedDocuments) {
    blockers.push(`${failed.length} document(s) failed validation or were rejected`);
  }
  if (!hasDocuments && requirements.length > 0) blockers.push("No documents uploaded");

  const canApprove = satisfied && !hasReviewRequired && !hasFailedDocuments && requirements.length > 0;

  return {
    requirements: reqResults,
    satisfied,
    hasReviewRequired,
    hasFailedDocuments,
    hasDocuments,
    canApprove,
    blockers,
  };
}
