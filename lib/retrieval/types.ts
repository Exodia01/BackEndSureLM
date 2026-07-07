export interface RetrievalResult {
  id: string;
  score: number;
  source: "fts" | "vector" | "history";
  payload: Record<string, unknown>;
  rank?: number;
}

export type ScoreRelevance = "high" | "medium" | "low";

export interface VectorFilterCondition {
  key: string;
  match?: { value: string | number };
  range?: { gte?: number; lte?: number; gt?: number; lt?: number };
}
