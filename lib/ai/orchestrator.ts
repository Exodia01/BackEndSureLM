import type {
  AgentMessage,
  RetrieverInput,
  RerankerInput,
  LLMInput,
  ContextResult,
} from "./agents/types";
import { hybridRetrieve } from "./agents/retriever";
import { rerank } from "./agents/reranker";
import { generateLLMResponse, streamLLMResponse } from "./agents/llm";
import { generateEmbedding as generateOllamaEmbedding } from "./embeddings";

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

    let embedding: number[] = [];
    let retrievalResults: ContextResult[] = [];

    try {
      console.log(`[Orchestrator] Generating embedding for query...`);
      embedding = await generateOllamaEmbedding(queryText);

      console.log(`[Orchestrator] Running hybrid retrieval...`);
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
      console.log(`[Orchestrator] Reranking top contexts...`);
      const rerankerInput: RerankerInput = {
        query: queryText,
        candidates: topContexts,
        topN: 5,
      };

      const rerankedResults = await this.rerankerAgent(rerankerInput);

      console.log(`[Orchestrator] Generating LLM response with context...`);
      return await this.llmAgent({
        systemPrompt: this.buildSystemPrompt(rerankedResults.results),
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
        systemPrompt: `You are a helpful assistant for SureLM. Use the following retrieved context to answer the user's question.

Retrieved Context:
${contextSection}

If the context doesn't contain relevant information, say so honestly.`,
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

export async function* orchestrateQueryStreaming(input: {
  messages: AgentMessage[];
  sessionId?: string;
}) {
  const orchestrator = new AgentOrchestrator();

  try {
    const stream = await orchestrator.runQueryWorkflowStreaming(input);

    yield* stream;
  } catch (error) {
    throw new Error(`Orchestration stream failed: ${(error as Error).message}`);
  }
}

export default AgentOrchestrator;
