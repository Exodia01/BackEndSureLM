import { RetrievalResult } from "@/lib/retrieval/types";
import type { RerankResult } from "./types";

export function applyRRFS(results: RetrievalResult[]): RerankResult[] {
  const rankBySource = new Map<string, number>();
  
  results.forEach((result) => {
    const key = `${result.source}`;
    const currentRank = rankBySource.get(key) || 0;
    result.rank = currentRank + 1;
    rankBySource.set(key, result.rank);
  });
  
  const rrfsResults = results.map((result) => {
    const k = 60;
    
    const score = 1 / (result.rank! + k);
    
    return {
      ...result,
      rerankedScore: score,
      relevanceRank: 0,
    };
  });
  
  rrfsResults.sort((a, b) => {
    if (b.rerankedScore !== a.rerankedScore) {
      return b.rerankedScore - a.rerankedScore;
    }
    
    const sourcePriority = { postgres_fts: 0, qdrant: 1, user_history: 2 };
    return (sourcePriority[a.source as keyof typeof sourcePriority] ?? 99) -
           (sourcePriority[b.source as keyof typeof sourcePriority] ?? 99);
  });
  
  rrfsResults.forEach((result, index) => {
    result.relevanceRank = index + 1;
    
    if (result.rerankedScore >= 0.005) {
      result.relevance = "high";
    } else if (result.rerankedScore >= 0.002) {
      result.relevance = "medium";
    } else {
      result.relevance = "low";
    }
  });
  
  return rrfsResults;
}
