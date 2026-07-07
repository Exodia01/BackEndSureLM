export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OrchestratorRequest {
  messages: AgentMessage[];
  agentId?: string;
  sessionId?: string;
}

export interface ContextResult {
  id: string;
  content: string;
  score: number;
  source: "postgres_fts" | "qdrant" | "user_history";
  metadata?: Record<string, unknown>;
}

export interface OrchestratorResponse {
  content: string;
  context: Array<{
    id: string;
    content: string;
    score: number;
    source: "postgres_fts" | "qdrant" | "user_history";
    metadata?: Record<string, unknown>;
    policyId?: string;
    policyName?: string;
    provider?: string;
  }>;
  toolsUsed: string[];
  agentId?: string;
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

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: { latencyMs: number; modelUsed?: string; source?: string };
}

export type WorkflowType = "query" | "issuance" | "document";

export type QueryWorkflowInput = OrchestratorRequest;

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

export type WorkflowInput = {
  query: QueryWorkflowInput;
  issuance: IssuanceWorkflowInput;
  document: never;
};

export type WorkflowOutput = {
  query: OrchestratorResponse;
  issuance: { issuances: Array<{ id: string; policyName: string }> };
  document: never;
};
