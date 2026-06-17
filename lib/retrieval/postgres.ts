import { db } from "../db";
import type { RetrievalResult } from "./types";

export async function postgresFullTextSearch(
  query: string,
  limit: number = 10
): Promise<RetrievalResult[]> {
  const results = await db.$queryRaw`
    SELECT 
      c.id as chunk_id,
      c."documentId",
      c."chunkOrder",
      c.content,
      ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', ${query})) as score
    FROM "Chunk" c
    WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((row: any) => ({
    id: String(row.chunk_id),
    score: Number(row.score) || 0,
    source: "fts" as const,
    payload: {
      chunk_id: String(row.chunk_id),
      document_id: row.documentid ? String(row.documentid) : undefined,
      chunk_order: row.chunkorder ?? undefined,
      content: row.content,
    }
  }));
}