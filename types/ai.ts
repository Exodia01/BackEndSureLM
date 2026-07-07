export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OrchestratorRequest {
  messages: AgentMessage[];
  agentId?: string;
  sessionId?: string;
}

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
  agentId: string;
}
