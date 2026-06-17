export interface RetrievalResult {
  id: string;
  source: "postgres_fts" | "qdrant" | "user_history";
  score: number;
  content?: string;
  policyId?: string;
  policyName?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface HybridSearchRequest {
  query: string;
  vector?: number[];
  agentId?: string;
  filter?: QdrantFilter;
  limit?: number;
}

export interface QdrantFilter {
  condition: "policy_id" | "chunk_index" | "source";
  match?: { value: string | number };
  range?: { gte?: number; lte?: number };
}

export interface RerankResult extends RetrievalResult {
  rerankedScore?: number;
  relevance?: "high" | "medium" | "low";
}

export type SearchResult = RerankResult;
