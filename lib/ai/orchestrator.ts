import type {
  AgentMessage,
  RetrieverInput,
  RerankerInput,
  LLMInput,
  ContextResult,
} from "./agents/types";
import { hybridRetrieve, retrievePoliciesWithContext } from "./agents/retriever";
import { rerank } from "./agents/reranker";
import { generateLLMResponse, streamLLMResponse } from "./agents/llm";
import { generateEmbedding as generateOllamaEmbedding } from "./embeddings";
import { detectRecommendationIntent, isPolicyQuestion } from "./intent";
import { generateRecommendations } from "./generateRecommendations";

export interface OrchestratorResponse {
  content: string;
  context: Array<{
    id: string;
    content: string;
    score: number;
    source: "postgres_fts" | "qdrant" | "user_history";
    metadata?: Record<string, unknown>;
  }>;
  toolsUsed: string[];
  agentId?: string;
}

export class AgentOrchestrator {
  private workflowId: string;

  constructor(workflowId?: string) {
    this.workflowId = workflowId || this.generateWorkflowId();
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  async runQueryWorkflow(input: {
    messages: AgentMessage[];
    sessionId?: string;
    agentId?: string;
  }): Promise<OrchestratorResponse> {
    const startTime = Date.now();

    if (!input.messages || input.messages.length === 0) {
      throw new Error("No messages provided");
    }

    const userMessage = input.messages.find((m) => m.role === "user");

    if (!userMessage?.content) {
      throw new Error("No user message found");
    }

    const queryText = userMessage.content;
    const recommendationIntent = detectRecommendationIntent(queryText);
    const policyQuestion = isPolicyQuestion(queryText);

    let embedding: number[] = [];
    let retrievalResults: ContextResult[] = [];
    let recommendationEvidence:
      | Awaited<ReturnType<typeof generateRecommendations>>
      | null = null;

    try {
      console.log(`[Orchestrator] Generating embedding for query...`);
      embedding = await generateOllamaEmbedding(queryText);

      // Recommendation queries route through the evidence-first engine.
      if (recommendationIntent) {
        console.log(`[Orchestrator] Recommendation intent detected, running recommendation engine...`);
        recommendationEvidence = await generateRecommendations(queryText, {});
        const recContext: ContextResult[] = recommendationEvidence.recommendations.map(
          (rec, i) => ({
            id: `recommendation-${rec.policyId}`,
            content: [
              `Policy: ${rec.policyName}`,
              `Reasoning: ${rec.reasoning}`,
              `Features: ${rec.features.join(", ")}`,
              `Concerns: ${rec.concerns.join(", ")}`,
              ...(rec.requirements.length
                ? [`Requirements: ${rec.requirements.map((r) => r.label).join(", ")}`]
                : []),
            ].join("\n"),
            score: rec.suitabilityScore,
            source: "qdrant" as const,
            policyId: rec.policyId,
            policyName: rec.policyName,
            metadata: {
              provenance: rec.citations,
            },
          })
        );
        retrievalResults = recContext;
      } else if (policyQuestion) {
        console.log(`[Orchestrator] Policy question, running approved-policy-aware retrieval...`);
        const policyAware = await retrievePoliciesWithContext(queryText, embedding, {
          onlyApproved: true,
          limit: 20,
        });
        const generic = await this.retrieverAgent({
          query: queryText,
          vector: embedding,
          sessionId: input.sessionId,
          limit: 20,
        });
        retrievalResults = mergeByChunkId([...policyAware, ...generic]);
      } else {
        console.log(`[Orchestrator] Running hybrid retrieval...`);
        const retrievalInput: RetrieverInput = {
          query: queryText,
          vector: embedding,
          sessionId: input.sessionId,
          limit: 20,
        };
        retrievalResults = await this.retrieverAgent(retrievalInput);
      }
    } catch (error) {
      console.warn(`[Orchestrator] Retrieval failed, proceeding with empty results: ${(error as Error).message}`);
    }

    const topContexts = retrievalResults.slice(0, 5);

    try {
      console.log(`[Orchestrator] Reranking top contexts...`);
      const rerankerInput: RerankerInput = {
        query: queryText,
        candidates: topContexts,
        topN: 5,
      };

      const rerankedResults = await this.rerankerAgent(rerankerInput);

      console.log(`[Orchestrator] Generating LLM response with context...`);
      return await this.llmAgent({
        systemPrompt: this.buildPolicyAwareSystemPrompt(
          rerankedResults.results,
          recommendationEvidence
        ),
        messages: input.messages.filter((m) => m.role !== "system"),
      });
    } catch (error) {
      console.warn(`[Orchestrator] Reranking/LLM failed, returning raw retrieval results`);

      const contextSection = topContexts
        .map(
          (result, idx) =>
            `Context ${idx + 1} (${result.score.toFixed(3)}): ${result.content}`
        )
        .join("\n\n");

      return await this.llmAgent({
        systemPrompt: this.buildPolicyAwareSystemPrompt(topContexts, recommendationEvidence, contextSection),
        messages: input.messages.filter((m) => m.role !== "system"),
      });
    }
  }

  async runQueryWorkflowStreaming(
    input: { messages: AgentMessage[]; sessionId?: string },
    signal?: AbortSignal
  ): Promise<ReadableStream> {
    const startTime = Date.now();

    if (!input.messages || input.messages.length === 0) {
      throw new Error("No messages provided");
    }

    const userMessage = input.messages.find((m) => m.role === "user");

    if (!userMessage?.content) {
      throw new Error("No user message found");
    }

    const queryText = userMessage.content;

    let embedding: number[] = [];
    let retrievalResults: ContextResult[] = [];

    try {
      console.log(`[Orchestrator] Generating embedding for stream...`);
      embedding = await generateOllamaEmbedding(queryText);

      console.log(`[Orchestrator] Running hybrid retrieval for stream...`);
      const retrievalInput: RetrieverInput = {
        query: queryText,
        vector: embedding,
        sessionId: input.sessionId,
        limit: 20,
      };

      retrievalResults = await this.retrieverAgent(retrievalInput);
    } catch (error) {
      console.warn(`[Orchestrator] Retrieval failed, proceeding with empty results: ${(error as Error).message}`);
    }

    const topContexts = retrievalResults.slice(0, 5);

    try {
      console.log(`[Orchestrator] Reranking for stream...`);
      const rerankerInput: RerankerInput = {
        query: queryText,
        candidates: topContexts,
        topN: 5,
      };

      const rerankedResults = await this.rerankerAgent(rerankerInput);

      console.log(`[Orchestrator] Streaming LLM response...`);
      return await this.llmAgentStreaming({
        systemPrompt: this.buildSystemPrompt(rerankedResults.results),
        messages: input.messages.filter((m) => m.role !== "system"),
      });
    } catch (error) {
      console.warn(`[Orchestrator] Reranking/LLM failed`);

      const contextSection = topContexts
        .map(
          (result, idx) =>
            `Context ${idx + 1} (${result.score.toFixed(3)}): ${result.content}`
        )
        .join("\n\n");

      return await this.llmAgentStreaming({
        systemPrompt: `You are a helpful assistant for SureLM. Use the following retrieved context to answer the user's question.

Retrieved Context:
${contextSection}

If the context doesn't contain relevant information, say so honestly.`,
        messages: input.messages.filter((m) => m.role !== "system"),
      });
    }
  }

  private buildSystemPrompt(results: ContextResult[]): string {
    const contextSection = results
      .map(
        (result, idx) =>
          `Context ${idx + 1} (${result.rerankedScore?.toFixed(3) || result.score.toFixed(3)}): ${result.content}`
      )
      .join("\n\n");

    return `You are a helpful assistant for SureLM. Use the following retrieved and reranked context to answer the user's question.

RERANKED CONTEXT:
${contextSection}

Each context has been scored and re-ranked based on its relevance to the query.
If a context doesn't contain relevant information, acknowledge it but continue with other contexts.`;
  }

  /**
   * Policy-aware system prompt. Grounds answers in retrieved policy evidence,
   * requires citations, prohibits unsupported claims, and explicitly discloses
   * insufficient evidence. `recommendationEvidence` (when present) carries the
   * structured recommendation result with provenance.
   */
  private buildPolicyAwareSystemPrompt(
    results: ContextResult[],
    recommendationEvidence?: Awaited<ReturnType<typeof generateRecommendations>> | null,
    contextSectionOverride?: string
  ): string {
    const contextSection =
      contextSectionOverride ??
      results
        .map((result, idx) => {
          const meta = (result.metadata as any) ?? {};
          const provenanceBits = [
            meta.policy_name ? `Policy: ${meta.policy_name}` : null,
            meta.brochure_name ? `Brochure: ${meta.brochure_name}` : null,
            meta.page_num != null ? `Page: ${meta.page_num}` : null,
            meta.policy_version_num != null ? `Version: ${meta.policy_version_num}` : null,
          ]
            .filter(Boolean)
            .join(" | ");
          const citation = `[Source ${idx + 1}]${provenanceBits ? ` (${provenanceBits})` : ""}`;
          return `${citation}: ${result.content}`;
        })
        .join("\n\n");

    const recommendationBlock = recommendationEvidence
      ? buildRecommendationBlock(recommendationEvidence)
      : "";

    return `You are a helpful assistant for SureLM grounded in approved life-insurance policy knowledge.

CONTEXT:
${contextSection}
${recommendationBlock}

INSTRUCTIONS:
- Answer ONLY using the policy evidence above.
- Cite sources inline using [Source N] whenever you reference a policy fact.
- NEVER fabricate policy terms, premiums, benefits, exclusions, eligibility, or requirements.
- If the evidence is insufficient to answer, say so explicitly instead of guessing.
- For recommendation answers, clearly state suitability is a model-derived ranking, not an underwriting decision.`;
  }

  private async retrieverAgent(input: RetrieverInput): Promise<ContextResult[]> {
    const startTime = Date.now();

    try {
      console.log(`[Retriever] Running hybrid retrieval for query: ${input.query.substring(0, 50)}...`);

      const results = await hybridRetrieve(
        input.query,
        undefined,
        input.vector || [],
        undefined
      );

      const latencyMs = Date.now() - startTime;
      console.log(`[Retriever] Retrieved ${results.length} results in ${latencyMs}ms`);

      return results;
    } catch (error) {
      console.error("[Retriever] Error:", error);
      throw new Error(`Retriever agent failed: ${(error as Error).message}`);
    }
  }

  private async rerankerAgent(input: RerankerInput): Promise<{ results: ContextResult[]; method: string }> {
    const startTime = Date.now();

    try {
      console.log(`[Reranker] Reranking ${input.candidates.length} candidates...`);

      const result = await rerank(input.query, input.candidates, input.topN || 5);

      const latencyMs = Date.now() - startTime;
      console.log(`[Reranker] Completed in ${latencyMs}ms using method: ${result.method}`);

      return { results: result.results, method: result.method };
    } catch (error) {
      console.error("[Reranker] Error:", error);
      throw new Error(`Reranker agent failed: ${(error as Error).message}`);
    }
  }

  private async llmAgent(input: LLMInput): Promise<OrchestratorResponse> {
    const startTime = Date.now();

    try {
      console.log(`[LLM] Generating response with ${input.messages.length} messages...`);

      const content = await generateLLMResponse([
        { role: "system", content: input.systemPrompt },
        ...input.messages.filter((m) => m.role !== "system"),
      ]);

      const latencyMs = Date.now() - startTime;
      console.log(`[LLM] Response generated in ${latencyMs}ms`);

      return {
        content,
        context: [],
        toolsUsed: ["retrieval", "llm"],
        agentId: this.workflowId,
      };
    } catch (error) {
      console.error("[LLM] Error:", error);
      throw new Error(`LLM agent failed: ${(error as Error).message}`);
    }
  }

  private async llmAgentStreaming(input: LLMInput): Promise<ReadableStream> {
    try {
      console.log(`[LLM-STREAM] Starting streaming response...`);

      const stream = await streamLLMResponse([
        { role: "system", content: input.systemPrompt },
        ...input.messages.filter((m) => m.role !== "system"),
      ]);

      return stream;
    } catch (error) {
      console.error("[LLM-STREAM] Error:", error);
      throw new Error(`LLM streaming failed: ${(error as Error).message}`);
    }
  }

  public getWorkflowId(): string {
    return this.workflowId;
  }
}

export async function orchestrateQuery(input: {
  messages: AgentMessage[];
  sessionId?: string;
  agentId?: string;
}): Promise<OrchestratorResponse> {
  const orchestrator = new AgentOrchestrator();

  try {
    return await orchestrator.runQueryWorkflow(input);
  } catch (error) {
    throw new Error(`Orchestration failed: ${(error as Error).message}`);
  }
}

export async function orchestrateQueryStreaming(input: {
  messages: AgentMessage[];
  sessionId?: string;
}): Promise<ReadableStream> {
  const orchestrator = new AgentOrchestrator();

  try {
    const stream = await orchestrator.runQueryWorkflowStreaming(input);

    return stream;
  } catch (error) {
    throw new Error(`Orchestration stream failed: ${(error as Error).message}`);
  }
}

/**
 * Merge two retrieval result sets by chunk id, keeping the highest score for
 * duplicates (deterministic: stable by score desc then original order).
 */
function mergeByChunkId(results: ContextResult[]): ContextResult[] {
  const byId = new Map<string, ContextResult>();
  for (const r of results) {
    const key = (r.metadata as any)?.chunk_id ?? r.id;
    const existing = byId.get(key);
    if (!existing || r.score > existing.score) {
      byId.set(key, r);
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.score - a.score);
}

/**
 * Build the recommendation evidence section of the policy-aware system prompt.
 * Plain string building avoids nested template literals.
 */
function buildRecommendationBlock(
  evidence: Awaited<ReturnType<typeof generateRecommendations>>
): string {
  const lines: string[] = ["", "RECOMMENDATION EVIDENCE (from approved/current policy knowledge):"];

  if (evidence.recommendations.length === 0) {
    lines.push(
      evidence.insufficientPolicyInformation
        ? "No approved policy knowledge matched this request."
        : "No recommendations were produced."
    );
  } else {
    evidence.recommendations.forEach((rec, i) => {
      lines.push(
        `Recommendation ${i + 1}: ${rec.policyName} (suitability ${rec.suitabilityScore}, ${rec.suitabilityLabel})`
      );
      lines.push(`- Reasoning: ${rec.reasoning}`);
      lines.push(`- Features: ${rec.features.join(", ")}`);
      lines.push(
        `- Requirements: ${rec.requirements.map((r) => r.label).join(", ") || "none surfaced"}`
      );
      lines.push(`- Concerns: ${rec.concerns.join(", ") || "none surfaced"}`);
    });
  }

  if (evidence.insufficientCustomerInformation) {
    lines.push(
      "NOTE: Customer profile information was incomplete; suitability is weak evidence at best."
    );
  }

  return lines.join("\n");
}

export default AgentOrchestrator;
