import { z } from "zod";
import { db } from "@/lib/db";
import { generateLLMResponse } from "@/lib/ai/agents/llm";

// Exactly three attempts per extraction run (founder decision).
export const MAX_ATTEMPTS = 3;

export const EXTRACTION_MODEL =
  process.env.EXTRACTION_MODEL || process.env.PRIMARY_MODEL_NAME || "qwen2.5-coder:1.5b";

// ---------------------------------------------------------------------------
// Zod-validated output schema. The LLM must emit exactly this shape; anything
// else is rejected and the run is retried (up to MAX_ATTEMPTS) before failing.
// ---------------------------------------------------------------------------

const ValidationRulesSchema = z
  .object({
    minEntryAge: z.number().min(0).max(120).nullable().optional(),
    maxEntryAge: z.number().min(0).max(120).nullable().optional(),
    minSumAssured: z.number().nonnegative().nullable().optional(),
    maxSumAssured: z.number().nonnegative().nullable().optional(),
    minPremium: z.number().nonnegative().nullable().optional(),
    maxPremium: z.number().nonnegative().nullable().optional(),
    // Term years are naturally multi-valued: brochures commonly list a fixed
    // scalar (e.g. "policy term: 25 years") OR an explicit menu of options
    // (e.g. "policy term: 10 / 15 / 20 / 25 / 30 years"). Accept both so the
    // schema reflects the source fidelity the frozen contract requires.
    policyTermYears: z
      .union([z.number().int().nonnegative(), z.array(z.number().int().nonnegative())])
      .nullable()
      .optional(),
    premiumTermYears: z
      .union([z.number().int().nonnegative(), z.array(z.number().int().nonnegative())])
      .nullable()
      .optional(),
    allowedPaymentModes: z.array(z.string()).optional(),
    notes: z.string().optional(),
  })
  .strict()
  .passthrough();

const ExtractedRequirementSchema = z.object({
  ruleKey: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  documentType: z.string().max(100).optional(),
  category: z.enum([
    "eligibility",
    "premium_payment",
    "death_benefit",
    "maturity_survival_benefit",
    "riders",
    "surrender_maturity",
    "policy_loan",
    "revival_lapse",
    "tax_benefits",
    "policy_features",
    "claims_conditions",
  ]),
  isMandatory: z.boolean().optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  onMaxAttemptsMessage: z.string().max(1000).optional(),
  confidence: z.number().min(0).max(1),
  extractionMode: z.enum(["EXPLICIT", "INFERRED", "UNCERTAIN"]),
  validationRules: ValidationRulesSchema.optional().default({}),
});

const ExtractionResponseSchema = z.object({
  productType: z.string().optional(),
  requirements: z.array(ExtractedRequirementSchema).min(1),
});

export type ExtractedRequirement = z.infer<typeof ExtractedRequirementSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildExtractionPrompt(chunks: { chunkOrder: number; content: string }[]): string {
  const documentText = chunks
    .map((c) => `[CHUNK ${c.chunkOrder}]\n${c.content}`)
    .join("\n\n");

  return `You are an insurance product analyst extracting underwriting and coverage requirements from a life insurance brochure.

Given the brochure text below, identify the requirements a customer must meet for the product to apply. Focus on LIFE INSURANCE requirements only.

For each requirement return:
- ruleKey: a stable snake_case identifier, e.g. "min_entry_age", "max_entry_age", "min_sum_assured", "payment_mode", "policy_term", "premium_term", "free_look_period", "revival_grace_period", "kyc_documents".
- label: short human-readable title.
- description: 1-3 sentence explanation of what the brochure states, quoting the specific figures.
- documentType: the type of source document this requirement was extracted from. Use "BROCHURE" unless the brochure text explicitly identifies another document type.
- category: one of eligibility, premium_payment, death_benefit, maturity_survival_benefit, riders, surrender_maturity, policy_loan, revival_lapse, tax_benefits, policy_features, claims_conditions.
- isMandatory: true when the brochure states the requirement as mandatory/required, false when explicitly optional.
- displayOrder: a 0-based ordering hint reflecting the order requirements appear in the brochure.
- onMaxAttemptsMessage: a short, customer-facing message to show when the customer cannot satisfy this requirement (e.g. after the maximum attempts). Write it in plain language based on what the brochure says; if the brochure is silent, describe the failure condition generically.
- confidence: 0..1.
- extractionMode: EXPLICIT if the brochure states the figure directly, INFERRED if it is reasonably derivable from stated figures, UNCERTAIN if ambiguous or missing.
- validationRules: an object capturing numeric thresholds only when explicitly present in the text (e.g. minEntryAge, maxEntryAge, minSumAssured, maxSumAssured, minPremium, maxPremium, policyTermYears, premiumTermYears, allowedPaymentModes). Omit fields not stated. When the brochure lists MULTIPLE allowed options for a term (e.g. "policy term: 10 / 15 / 20 / 25 / 30 years"), represent policyTermYears/premiumTermYears as an array of numbers (e.g. [10, 15, 20, 25, 30]); use a single number only when the brochure states one fixed term.

Respond with STRICT JSON only, no markdown, matching exactly:
{"productType": string, "requirements": [{"ruleKey": string, "label": string, "description": string, "documentType": string, "category": string, "isMandatory": boolean, "displayOrder": number, "onMaxAttemptsMessage": string, "confidence": number, "extractionMode": "EXPLICIT"|"INFERRED"|"UNCERTAIN", "validationRules": { ... }}]}

BROCHURE TEXT:
${documentText}`;
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function parseExtractionResponse(raw: string): ExtractionResponse {
  const stripped = stripCodeFence(raw);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch {
    throw new Error("Extraction output was not valid JSON");
  }
  return ExtractionResponseSchema.parse(json);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Extract requirement definitions from a brochure's chunks into DRAFT records
 * for a given policy. This is a SEPARATE operation from processBrochure():
 * the brochure must already be READY (chunks present) and the Policy must
 * exist. Results are always stored with isDraft=true; an ADMIN must approve
 * them before they can be snapshotted into a PolicyVersion.
 *
 * Provenance is recorded as structured JSON:
 *   { source_brochure_id, source_chunk_ids, extraction_model, extracted_at }
 */
export async function extractRequirements(
  brochureId: string,
  policyId: string
): Promise<{ draftsCreated: number; requirements: ExtractedRequirement[] }> {
  if (!policyId) {
    throw new Error("policyId is required to extract requirements");
  }

  const [brochure, policy, chunks] = await Promise.all([
    db.brochure.findUnique({ where: { id: brochureId } }),
    db.policy.findUnique({ where: { id: policyId } }),
    db.chunk.findMany({
      where: { brochureId },
      orderBy: { chunkOrder: "asc" },
      select: { id: true, chunkOrder: true, content: true },
    }),
  ]);

  if (!brochure) throw new Error("Brochure not found");
  if (!policy) throw new Error("Policy not found");
  if (brochure.status !== "READY") {
    throw new Error("Brochure must be READY before requirements can be extracted");
  }
  if (chunks.length === 0) {
    throw new Error("Brochure has no chunks; run processBrochure first");
  }

  const prompt = buildExtractionPrompt(chunks);

  let parsed: ExtractionResponse | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await generateLLMResponse(
        [{ role: "system", content: prompt }],
        EXTRACTION_MODEL
      );
      parsed = parseExtractionResponse(raw);
      break;
    } catch (error) {
      lastError = error;
      console.warn(`[extractRequirements] Attempt ${attempt}/${MAX_ATTEMPTS} failed:`, error);
    }
  }

  if (!parsed) {
    throw new Error(
      `Requirement extraction failed after ${MAX_ATTEMPTS} attempts: ${(lastError as Error)?.message}`
    );
  }

  const provenance = {
    source_brochure_id: brochureId,
    source_chunk_ids: chunks.map((c) => c.id),
    extraction_model: EXTRACTION_MODEL,
    extracted_at: new Date().toISOString(),
  };

  // Replace any previous drafts for this policy in one transaction. Approved
  // (isDraft=false) definitions are never touched here.
  await db.$transaction(async (tx) => {
    await tx.requirementDefinition.deleteMany({
      where: { policyId, brochureId, isDraft: true },
    });

    for (const req of parsed.requirements) {
      await tx.requirementDefinition.create({
        data: {
          policyId,
          brochureId,
          isDraft: true,
          ruleKey: req.ruleKey,
          label: req.label,
          description: req.description,
          documentType: req.documentType ?? null,
          category: req.category,
          isMandatory: req.isMandatory ?? null,
          displayOrder: req.displayOrder ?? null,
          onMaxAttemptsMessage: req.onMaxAttemptsMessage ?? null,
          confidence: req.confidence,
          extractionMode: req.extractionMode,
          validationRules: req.validationRules as object,
          provenance,
          sourceChunkIds: chunks.map((c) => c.id),
          maxAttempts: MAX_ATTEMPTS,
        },
      });
    }
  });

  return { draftsCreated: parsed.requirements.length, requirements: parsed.requirements };
}

/**
 * Approve a draft requirement (ADMIN action). Sets isDraft=false and stamps
 * who/when. Rejects if the ruleKey already has an approved definition to keep
 * the @@unique([policyId, ruleKey, isDraft]) constraint intact.
 */
export async function approveRequirement(
  requirementId: string,
  approvedBy: string
) {
  const existing = await db.requirementDefinition.findUnique({
    where: { id: requirementId },
  });

  if (!existing) throw new Error("Requirement not found");
  if (!existing.isDraft) return existing;

  const conflicting = await db.requirementDefinition.findFirst({
    where: {
      policyId: existing.policyId,
      ruleKey: existing.ruleKey,
      isDraft: false,
    },
  });

  if (conflicting) {
    throw new Error(
      `Policy already has an approved requirement for ruleKey "${existing.ruleKey}"`
    );
  }

  return db.requirementDefinition.update({
    where: { id: requirementId },
    data: {
      isDraft: false,
      approvedAt: new Date(),
      approvedBy,
    },
  });
}

/**
 * List requirement definitions for a policy, optionally drafts only.
 */
export async function listPolicyRequirements(
  policyId: string,
  includeDrafts: boolean = true
) {
  return db.requirementDefinition.findMany({
    where: { policyId, ...(includeDrafts ? {} : { isDraft: false }) },
    orderBy: [{ isDraft: "asc" }, { ruleKey: "asc" }],
  });
}

/**
 * Edit an existing DRAFT requirement definition (ADMIN action).
 *
 * Only isDraft=true definitions may be edited. Approved requirements are
 * authoritative and immutable; editing them would corrupt the version/snapshot
 * history. The stable ruleKey is never editable. Returns the updated record.
 */
export async function editRequirementDraft(
  requirementId: string,
  policyId: string,
  data: {
    label?: string;
    description?: string;
    validationRules?: object;
  }
) {
  const existing = await db.requirementDefinition.findUnique({
    where: { id: requirementId },
  });

  if (!existing || existing.policyId !== policyId) {
    throw new Error("Requirement not found for this policy");
  }
  if (!existing.isDraft) {
    throw new Error("Approved requirements cannot be edited");
  }

  const update: Record<string, unknown> = {};
  if (data.label !== undefined) {
    if (typeof data.label !== "string" || data.label.trim().length === 0) {
      throw new Error("label must be a non-empty string");
    }
    update.label = data.label.trim();
  }
  if (data.description !== undefined) {
    update.description =
      typeof data.description === "string" ? data.description : null;
  }
  if (data.validationRules !== undefined) {
    update.validationRules = data.validationRules;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("Nothing to update");
  }

  return db.requirementDefinition.update({
    where: { id: requirementId },
    data: update,
  });
}

/**
 * Reject a DRAFT requirement definition (ADMIN action).
 *
 * Audit-safe by construction: only isDraft=true (ephemeral, re-extractable)
 * definitions may be deleted — the same lifecycle already used by
 * extractRequirements() when replacing stale drafts. Approved requirements are
 * authoritative and may be referenced by immutable RequirementSnapshots, so
 * they are never hard-deleted.
 */
export async function rejectRequirementDraft(
  requirementId: string,
  policyId: string
): Promise<void> {
  const existing = await db.requirementDefinition.findUnique({
    where: { id: requirementId },
  });

  if (!existing || existing.policyId !== policyId) {
    throw new Error("Requirement not found for this policy");
  }
  if (!existing.isDraft) {
    throw new Error(
      "Approved requirements cannot be deleted; reject drafts only"
    );
  }

  await db.requirementDefinition.delete({ where: { id: requirementId } });
}
