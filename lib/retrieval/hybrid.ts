import { postgresFullTextSearch } from "./postgres";
import { qdrantVectorSearch } from "./vector/index";
import type { RetrievalResult } from "./types";

export async function hybridSearch(
  query: string,
  queryVector: number[],
  sessionId?: string
): Promise<RetrievalResult[]> {
  const results = await Promise.all([
    postgresFullTextSearch(query).then((r) => r as RetrievalResult[]),
    qdrantVectorSearch(queryVector).then((r) => r as RetrievalResult[]),
    sessionId ? userHistoryLookup(sessionId) : Promise.resolve([] as RetrievalResult[]),
  ]);

  // Flatten and deduplicate by chunk_id (from payload, keep highest score)
  const chunkIdMap = new Map<string, RetrievalResult>();

  for (const result of results.flat()) {
    const chunkId = String(result.payload.chunk_id);
    if (!chunkIdMap.has(chunkId)) {
      chunkIdMap.set(chunkId, { ...result });
    } else {
      const existing = chunkIdMap.get(chunkId);
      if (existing && result.score > existing.score) {
        chunkIdMap.set(chunkId, { ...result, score: result.score });
      }
    }
  }

  // Sort by score descending
  return Array.from(chunkIdMap.values()).sort((a, b) => b.score - a.score);
}

export async function userHistoryLookup(
  sessionId: string
): Promise<RetrievalResult[]> {
  return [];
}