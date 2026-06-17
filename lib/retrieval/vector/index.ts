import { healthCheck, ensureCollection, upsertPoints, searchPoints, deletePoints } from "./qdrantStorage";
import type { VectorPoint, VectorSearchOptions } from "./types";

export { healthCheck, ensureCollection, upsertPoints, searchPoints, deletePoints };

export async function qdrantVectorSearch(
  vector: number[],
  collectionName: string = "content_chunks",
  filter?: VectorSearchOptions
): Promise<{ id: string; score: number; payload: Record<string, unknown> }[]> {
  await ensureCollection(collectionName, vector.length);
  
  const results = await searchPoints(collectionName, vector, filter);
  
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