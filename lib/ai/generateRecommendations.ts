import { z } from "zod";
import { db } from "@/lib/db";
import { generateLLMResponse } from "@/lib/ai/agents/llm";
import {
  retrievePoliciesWithContext,
  resolveRecommendablePolicyIds,
} from "@/lib/ai/agents/retriever";
import { generateOllamaEmbedding } from "@/lib/ai/embeddings";
import { applyProductAwareRerank } from "@/lib/ai/agents/reranker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomerContext {
  age?: number;
  income?: number;
  familySize?: number;
  existingPolicies?: string[];
  goals?: string[];
}

export interface RecommendationCitation {
  chunkId: string;
  brochureId?: string;
  brochureName?: string;
  pageNum?: number | null;
  policyId?: string;
  policyName?: string;
  policyVersionNum?: number | null;
}

export interface PolicyRecommendation {
  policyId: string;
  policyName: string;
  provider?: string;
  /**
   * Model-derived suitability ranking, NOT an underwriting decision or an
   * actuarial probability. Stored as 0..1 and explicitly labelled.
   */
  suitabilityScore: number;
  suitabilityLabel: "model_derived" | "evidence_based";
  reasoning: string;
  features: string[];
  requirements: Array<{
    ruleKey: string;
    label: string;
    description?: string;
  }>;
  concerns: string[];
  citations: RecommendationCitation[];
}

export interface RecommendationResult {
  recommendations: PolicyRecommendation[];
  /**
   * True when the engine had no policy knowledge to draw on. Callers must
   * surface this honestly rather than letting the LLM invent policies.
   */
  insufficientPolicyInformation: boolean;
  /**
   * True when customer context (age/income/goals) was missing or incomplete,
   * meaning suitability is weak evidence at best.
   */
  insufficientCustomerInformation: boolean;
}

const RecommendationSchema = z.object({
  policyId: z.string(),
  policyName: z.string(),
  reasoning: z.string(),
  features: z.array(z.string()),
  concerns: z.array(z.string()),
  suitabilityScore: z.number().min(0).max(1),
});

const RecommendationListSchema = z.object({
  recommendations: z.array(RecommendationSchema).min(1),
});

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(
  customerContext: CustomerContext,
  evidence: {
    policyId: string;
    policyName: string;
    provider?: string;
    chunks: string[];
    requirements: Array<{ ruleKey: string; label: string; description?: string }>;
  }[]
): string {
  const customerLine = [
    customerContext.age ? `age: ${customerContext.age}` : null,
    customerContext.income ? `annual income: ${customerContext.income}` : null,
    customerContext.familySize ? `family size: ${customerContext.familySize}` : null,
    customerContext.goals?.length
      ? `goals: ${customerContext.goals.join(", ")}`
      : null,
    customerContext.existingPolicies?.length
      ? `existing policies: ${customerContext.existingPolicies.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  const policyBlocks = evidence
    .map((p, i) => {
      const requirementLines = p.requirements
        .map(
          (r) =>
            `  - ${r.label}${r.description ? `: ${r.description}` : ""} [${r.ruleKey}]`
        )
        .join("\n");
      return `POLICY ${i + 1}: ${p.policyName}${p.provider ? ` (${p.provider})` : ""} [policyId: ${p.policyId}]
RETRIEVED EVIDENCE:
${p.chunks.map((c) => `  [CHUNK] ${c}`).join("\n")}
APPROVED REQUIREMENTS:
${requirementLines || "  (none surfaced)"}`;
    })
    .join("\n\n");

  return `You are a life-insurance recommendation analyst. Recommend suitable life insurance policies based ONLY on the retrieved evidence and approved requirements below.

CUSTOMER PROFILE:
${customerLine || "No structured customer profile provided."}

POLICY EVIDENCE:
${policyBlocks}

INSTRUCTIONS:
- Rank policies by suitability for this customer using the evidence.
- suitabilityScore is a MODEL-DERIVED RANKING (0..1), NOT an underwriting decision or actuarial probability.
- reasoning must reference specific evidence (features, eligibility, exclusions) from the retrieved chunks and approved requirements.
- features must be grounded in retrieved evidence; never fabricate benefits, premiums, exclusions, or eligibility conditions.
- concerns should surface exclusions/conditions only when supported by evidence.
- If evidence is insufficient to rank or to support a claim, say so in reasoning; never guess.
- "policyId" must be the exact [policyId: ...] value shown in the POLICY headers above. Never invent an ID.
- Respond with STRICT JSON only, no markdown, matching exactly:
{"recommendations":[{"policyId":string,"policyName":string,"reasoning":string,"features":[string],"concerns":[string],"suitabilityScore":number}]}

IMPORTANT: Only include policies that appear in the evidence above. Never invent a policy.`;
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

/**
 * Evidence-first recommendation engine.
 *
 * Pipeline: customer query → embedding → retrieval (approved/current policy
 * knowledge only) → approved requirements → LLM reasoning → ranked response.
 *
 * Never lets the LLM invent policy terms: the evidence blocks above are the
 * only source of policy facts. On LLM parse failure we fall back to a
 * transparent evidence-based ranking (no manufactured reasoning). With no
 * matching policies, we return an explicit insufficientPolicyInformation flag.
 */
export async function generateRecommendations(
  query: string,
  customerContext: CustomerContext = {}
): Promise<RecommendationResult> {
  const insufficientCustomerInformation = !customerContext.age &&
    !customerContext.income &&
    !customerContext.familySize &&
    !(customerContext.goals && customerContext.goals.length > 0);

  let vector: number[] = [];
  try {
    vector = await generateOllamaEmbedding(query);
  } catch (error) {
    console.warn(
      `[Recommendation] Embedding failed, proceeding with empty evidence: ${(error as Error).message}`
    );
    return {
      recommendations: [],
      insufficientPolicyInformation: true,
      insufficientCustomerInformation,
    };
  }

  const recommendablePolicyIds = await resolveRecommendablePolicyIds();
  if (recommendablePolicyIds.length === 0) {
    return {
      recommendations: [],
      insufficientPolicyInformation: true,
      insufficientCustomerInformation,
    };
  }

  const retrievalLimit = Math.min(10, Math.max(3, recommendablePolicyIds.length * 2));
  const rawResults = await retrievePoliciesWithContext(query, vector, {
    onlyApproved: true,
    limit: retrievalLimit,
  });

  if (rawResults.length === 0) {
    return {
      recommendations: [],
      insufficientPolicyInformation: true,
      insufficientCustomerInformation,
    };
  }

  // Rerank retrieved results using product-aware scoring
  const rerankedResults = applyProductAwareRerank(query, rawResults, retrievalLimit);
  const results = rerankedResults.map((r) => ({
    ...r,
    // Preserve the original Qdrant score for evidence grouping
    score: r.score,
  }));

  // Group evidence by policy using the enriched provenance.
  const evidenceByPolicy = new Map<
    string,
    {
      policyId: string;
      policyName: string;
      provider?: string;
      chunks: string[];
      citations: RecommendationCitation[];
    }
  >();

  for (const r of results) {
    const policyId = r.policyId as string | undefined;
    if (!policyId) continue;
    const entry =
      evidenceByPolicy.get(policyId) ??
      {
        policyId,
        policyName: (r.policyName as string) || "Policy",
        provider: r.provider as string | undefined,
        chunks: [],
        citations: [],
      };
    if (r.content) entry.chunks.push(r.content);
    entry.citations.push({
      chunkId: r.id,
      brochureId: (r.metadata as any)?.brochure_id as string | undefined,
      brochureName: (r.metadata as any)?.brochure_name as string | undefined,
      pageNum: (r.metadata as any)?.page_num as number | null | undefined,
      policyId,
      policyName: entry.policyName,
      policyVersionNum: (r.metadata as any)?.policy_version_num as number | null | undefined,
    });
    evidenceByPolicy.set(policyId, entry);
  }

  if (evidenceByPolicy.size === 0) {
    return {
      recommendations: [],
      insufficientPolicyInformation: true,
      insufficientCustomerInformation,
    };
  }

  // Fetch approved requirement definitions for each policy that surfaced.
  const policyIds = [...evidenceByPolicy.keys()];
  const approvedRequirements = await db.requirementDefinition.findMany({
    where: { policyId: { in: policyIds }, isDraft: false },
    orderBy: [{ policyId: "asc" }, { ruleKey: "asc" }],
  });

  const requirementsByPolicy = new Map<
    string,
    Array<{ ruleKey: string; label: string; description?: string }>
  >();
  for (const req of approvedRequirements) {
    const list = requirementsByPolicy.get(req.policyId) ?? [];
    list.push({
      ruleKey: req.ruleKey,
      label: req.label,
      description: req.description ?? undefined,
    });
    requirementsByPolicy.set(req.policyId, list);
  }

  const evidence = [...evidenceByPolicy.values()].map((e) => ({
    policyId: e.policyId,
    policyName: e.policyName,
    provider: e.provider,
    chunks: e.chunks.slice(0, 6),
    requirements: requirementsByPolicy.get(e.policyId) ?? [],
    citations: e.citations,
  }));

  // Attempt LLM ranking; fall back to evidence-based ranking on any failure.
  let llmRanked: PolicyRecommendation[] | null = null;
  try {
    llmRanked = await runLlmRanking(query, customerContext, evidence);
  } catch (error) {
    console.warn(
      `[Recommendation] LLM ranking failed, using evidence-based fallback: ${(error as Error).message}`
    );
  }

  const recommendations = llmRanked ?? evidenceBasedRanking(evidence);

  return {
    recommendations,
    insufficientPolicyInformation: false,
    insufficientCustomerInformation,
  };
}

// ---------------------------------------------------------------------------
// Ranking helpers
// ---------------------------------------------------------------------------

async function runLlmRanking(
  query: string,
  customerContext: CustomerContext,
  evidence: {
    policyId: string;
    policyName: string;
    provider?: string;
    chunks: string[];
    requirements: Array<{ ruleKey: string; label: string; description?: string }>;
    citations: RecommendationCitation[];
  }[]
): Promise<PolicyRecommendation[]> {
  const prompt = buildPrompt(customerContext, evidence);
  const raw = await generateLLMResponse([
    { role: "system", content: prompt },
    { role: "user", content: query },
  ]);

  const stripped = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1");
  const parsed = RecommendationListSchema.parse(JSON.parse(stripped));

  const evidenceById = new Map(evidence.map((e) => [e.policyId, e]));

  // Safety net: only keep recommendations whose policyId was actually in the
  // retrieval evidence. A fabricated ID must never surface (P1: the LLM never
  // invents policies). When nothing survives, fall back to evidence ranking.
  const backed = parsed.recommendations.filter((rec) => evidenceById.has(rec.policyId));
  if (backed.length === 0) {
    throw new Error("LLM returned no evidence-backed policyIds");
  }

  return backed.map((rec) => {
    const ev = evidenceById.get(rec.policyId)!;
    return {
      policyId: rec.policyId,
      policyName: rec.policyName,
      provider: ev?.provider,
      suitabilityScore: rec.suitabilityScore,
      suitabilityLabel: "model_derived" as const,
      reasoning: rec.reasoning,
      features: rec.features,
      requirements: ev?.requirements ?? [],
      concerns: rec.concerns,
      citations: ev?.citations ?? [],
    };
  });
}

function evidenceBasedRanking(
  evidence: {
    policyId: string;
    policyName: string;
    provider?: string;
    chunks: string[];
    requirements: Array<{ ruleKey: string; label: string; description?: string }>;
    citations: RecommendationCitation[];
  }[]
): PolicyRecommendation[] {
  return evidence
    .slice()
    .sort((a, b) => b.chunks.length - a.chunks.length)
    .map((e) => ({
      policyId: e.policyId,
      policyName: e.policyName,
      provider: e.provider,
      suitabilityScore: 0,
      suitabilityLabel: "evidence_based" as const,
      reasoning:
        "Ranked by quantity of retrieved policy evidence (LLM ranking was unavailable). Not an underwriting recommendation.",
      features: [],
      requirements: e.requirements,
      concerns: [],
      citations: e.citations,
    }));
}
