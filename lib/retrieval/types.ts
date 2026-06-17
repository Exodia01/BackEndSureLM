export interface RetrievalResult {
  id: string;
  score: number;
  source: "fts" | "vector" | "history";
  payload: Record<string, unknown>;
}