/**
 * Deterministic application checklist evaluation.
 *
 * The checklist is evaluated EXCLUSIVELY against the application's frozen
 * RequirementSnapshot (captured at policy-version publish time). Current/latest
 * policy requirements never participate: the frozen snapshot is authoritative.
 *
 * Semantics (Phase 4C + Phase 2J taxonomy reconciliation):
 *  - Each requirement is classified as CUSTOMER_EVIDENCE, POLICY_KNOWLEDGE,
 *    or UNCLASSIFIED before evaluation.
 *  - POLICY_KNOWLEDGE requirements are satisfied from authoritative
 *    policy/brochure context — no customer document needed.
 *  - CUSTOMER_EVIDENCE requirements require a VALIDATED document whose
 *    validation report is PASS (unchanged from Phase 4C).
 *  - UNCLASSIFIED requirements fail closed: approval is impossible.
 *  - The "No documents uploaded" blocker is emitted ONLY when at least one
 *    CUSTOMER_EVIDENCE requirement exists and no documents are present.
 */
import type { DocumentTypeKey } from "@/lib/documents/schemas";

export type RequirementClassification =
  | "CUSTOMER_EVIDENCE"
  | "POLICY_KNOWLEDGE"
  | "UNCLASSIFIED";

/**
 * Rule keys that are definitively customer evidence (require customer documents).
 * These are the only requirements that need uploaded/validated documents.
 */
const CUSTOMER_EVIDENCE_KEYS = new Set([
  "kyc_documents",
  "kyc_pan",
  "kyc_aadhaar",
  "identity_proof",
  "address_proof",
  "income_proof",
  "bank_statement",
]);

/** Artifact / extraction-noise patterns — always UNCLASSIFIED (fail closed). */
const ARTIFACT_RE = /^max_attempts_/i;

/**
 * Classify a frozen requirement into one of three evidence categories.
 *
 *  - CUSTOMER_EVIDENCE: requires a customer-supplied document (e.g. KYC).
 *  - POLICY_KNOWLEDGE: product fact satisfied from authoritative context.
 *  - UNCLASSIFIED: ambiguous, artifact, or unsupported — fail closed.
 *
 * In a policy knowledge base the default is POLICY_KNOWLEDGE: every ruleKey
 * that is not explicitly customer evidence or an extraction artifact is a
 * product fact derivable from the brochure/snapshot context.  This avoids
 * brittle pattern-matching across 80+ naming conventions (camelCase, snake_case,
 * Indian-annuitant-specific keys, etc.).
 */
export function classifyRequirement(ruleKey: string): RequirementClassification {
  if (!ruleKey) return "UNCLASSIFIED";

  // Explicit customer evidence set (deterministic, documented)
  if (CUSTOMER_EVIDENCE_KEYS.has(ruleKey)) return "CUSTOMER_EVIDENCE";

  // Artifact detection — extraction noise, not real requirements
  if (ARTIFACT_RE.test(ruleKey)) return "UNCLASSIFIED";

  // Default: product/policy knowledge in a policy knowledge base
  return "POLICY_KNOWLEDGE";
}

export interface FrozenRequirement {
  id?: string | null;
  ruleKey: string;
  label: string;
  description?: string | null;
  documentType?: string | null;
  category?: string | null;
  isMandatory?: boolean | null;
  displayOrder?: number | null;
  onMaxAttemptsMessage?: string | null;
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
  classification: RequirementClassification;
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

  let hasEvidenceGatedRequirements = false;

  const reqResults: ChecklistRequirementResult[] = requirements.map((req) => {
    const classification = classifyRequirement(req.ruleKey);

    if (classification === "POLICY_KNOWLEDGE") {
      return {
        ruleKey: req.ruleKey,
        label: req.label,
        classification,
        evidenceDocType: null,
        satisfied: true,
        evidenceDocumentId: null,
        reason: "Product knowledge requirement satisfied from authoritative policy context",
      };
    }

    if (classification === "CUSTOMER_EVIDENCE") {
      hasEvidenceGatedRequirements = true;
      const evidenceDocType = resolveEvidenceDocType(req.ruleKey);
      const evidence =
        evidenceDocType === null
          ? null
          : validatedPassing.find(
              (d) =>
                (d.requirementRuleKey !== null && d.requirementRuleKey === req.ruleKey) ||
                d.docType === evidenceDocType
            ) ?? null;

      if (evidence) {
        return {
          ruleKey: req.ruleKey,
          label: req.label,
          classification,
          evidenceDocType,
          satisfied: true,
          evidenceDocumentId: evidence.id,
          reason: `Evidence: VALIDATED ${evidence.docType} (${evidence.id})`,
        };
      }
      return {
        ruleKey: req.ruleKey,
        label: req.label,
        classification,
        evidenceDocType,
        satisfied: false,
        evidenceDocumentId: null,
        reason: evidenceDocType
          ? `Missing validated ${evidenceDocType} evidence`
          : "Customer evidence requirement with no mapped document type",
      };
    }

    // UNCLASSIFIED — fail closed
    return {
      ruleKey: req.ruleKey,
      label: req.label,
      classification,
      evidenceDocType: null,
      satisfied: false,
      evidenceDocumentId: null,
      reason: "Unclassified requirement; cannot be confirmed deterministically",
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
  if (!hasDocuments && hasEvidenceGatedRequirements) {
    blockers.push("No documents uploaded");
  }

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
