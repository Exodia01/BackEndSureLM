export type AgentRole = "retriever" | "reranker" | "llm" | "documentProcessor";

export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentConfig {
  model?: string;
  timeoutMs?: number;
  fallbackEnabled?: boolean;
  maxRetries?: number;
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    latencyMs: number;
    modelUsed?: string;
    source?: string;
  };
}

export interface ContextResult {
  id: string;
  content: string;
  score: number;
  source: "postgres_fts" | "qdrant" | "user_history";
  metadata?: Record<string, unknown>;
  policyId?: string;
  policyName?: string;
  provider?: string;
}

export interface RerankResult extends ContextResult {
  rerankedScore?: number;
  relevanceRank?: number;
  relevance?: "high" | "medium" | "low";
}

export interface WorkflowContext {
  id: string;
  workflowType: "query" | "issuance" | "document";
  status: "pending" | "running" | "completed" | "failed";
  input: Record<string, unknown>;
  intermediateResults: Record<string, unknown>;
  finalOutput?: Record<string, unknown>;
  agentsExecuted: string[];
  errors: Array<{ agent: string; error: string }>;
  timestamps: {
    created: string;
    started?: string;
    completed?: string;
  };
}

export interface RetrieverInput {
  query: string;
  vector?: number[];
  sessionId?: string;
  limit?: number;
}

export interface RetrieverOutput {
  results: ContextResult[];
  metadata: { sourcesUsed: string[]; latencyMs: number };
}

export interface RerankerInput {
  query: string;
  candidates: ContextResult[];
  topN?: number;
}

export interface RerankerOutput {
  rerankedResults: RerankResult[];
  method: "rrfs" | "semantic" | "hybrid";
}

export interface LLMInput {
  systemPrompt: string;
  messages: AgentMessage[];
  useStreaming?: boolean;
}

export interface LLMOutput {
  content: string;
  modelUsed: string;
  fallbackUsed: boolean;
  metadata?: { latencyMs: number };
}

export interface DocumentProcessInput {
  brochureId: string;
  fileData: ArrayBuffer;
  filename: string;
}

export interface DocumentProcessOutput {
  chunksCreated: number;
  totalPages: number;
  qdrantUpserted: number;
}

export type WorkflowType = "query" | "issuance" | "document";

export interface QueryWorkflowInput {
  messages: AgentMessage[];
  sessionId?: string;
  agentId?: string;
}

export interface IssuanceWorkflowInput {
  leadId: string;
  requirements: {
    income?: number;
    occupation?: string;
    state?: string;
    familySize?: number;
    priorities?: string[];
    budgetMonthly?: number;
  };
}

export interface DocumentWorkflowInput {
  brochureId: string;
  fileData: ArrayBuffer;
  filename: string;
}

export type WorkflowInput = {
  query: QueryWorkflowInput;
  issuance: IssuanceWorkflowInput;
  document: DocumentWorkflowInput;
};

export type WorkflowOutput = {
  query: { content: string; context: Array<{ id: string; content: string; score: number; source: "postgres_fts" | "qdrant" | "user_history"; metadata?: Record<string, unknown> }> };
  issuance: { issuances: Array<{ id: string; policyName: string }> };
  document: DocumentProcessOutput;
};
