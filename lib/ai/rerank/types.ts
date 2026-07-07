import { RetrievalResult } from "@/lib/retrieval/types";

export type rerankInput = string;

export interface rerankOutput {
  score: number;
}

export interface RerankResult extends RetrievalResult {
  rerankedScore?: number;
  relevanceRank?: number;
  relevance?: "high" | "medium" | "low";
  content?: string;
  policyId?: string;
  policyName?: string;
  provider?: string;
}
