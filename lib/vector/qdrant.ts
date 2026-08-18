import { healthCheck, ensureCollection, upsertPoints, searchPoints } from "./qdrantStorage";
import type { VectorPoint, VectorSearchOptions, VectorFilterCondition } from "./types";

export { healthCheck, ensureCollection, upsertPoints, searchPoints };

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6334";

export async function semanticSearch(
  vector: number[],
  filter?: VectorFilterCondition[]
): Promise<{ id: string; score: number; payload: Record<string, unknown> }[]> {
  await ensureCollection("content_chunks", vector.length);

  const results = await searchPoints("content_chunks", vector, { filter });

  return results.map(r => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload,
  }));
}

export async function chunkToVectorPoint(
  chunkId: string,
  vector: number[],
  metadata?: Record<string, unknown>
): Promise<VectorPoint> {
  const category = metadata?.category || "general";

  return {
    id: chunkId,
    vector,
    payload: {
      chunk_id: chunkId,
      document_id: metadata?.document_id,
      page_number: metadata?.page_number,
      category,
      ...metadata,
    },
  };
}